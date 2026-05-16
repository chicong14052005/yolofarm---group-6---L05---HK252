"""Evaluate forecast predictions against actual sensor data.

Queries forecast.humidity_forecasts for predictions whose forecast time has elapsed,
compares against actual MySQL sensor_data, and writes results to:
  - forecast.forecast_evaluations (per-point)
  - forecast.drift_metrics (aggregate)
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import pandas as pd

from src.data.connectors.mysql_source import load_sensor_history
from src.data.connectors.timescale_store import save_evaluations, save_drift_metric


def _compute_metrics(actuals: np.ndarray, predictions: np.ndarray) -> dict:
    """Compute MAE, RMSE, MAPE, and bias between actual and predicted arrays."""
    mask = ~(np.isnan(actuals) | np.isnan(predictions))
    actuals = actuals[mask]
    predictions = predictions[mask]

    if len(actuals) == 0:
        return {"mae": None, "rmse": None, "mape": None, "bias": None, "count": 0}

    errors = actuals - predictions
    abs_errors = np.abs(errors)
    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    mape = float(np.mean(np.abs(errors) / np.maximum(np.abs(actuals), 1e-6))) * 100
    bias = float(np.mean(errors))

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "mape": round(mape, 4),
        "bias": round(bias, 4),
        "count": len(actuals),
    }


def _horizon_from_delta(delta_minutes: int) -> int:
    return max(1, round(delta_minutes / 60))


def run_evaluation(
    lookback_hours: int = 48,
    model_version: Optional[str] = None,
    timescale_dsn: Optional[str] = None,
    mysql_config: Optional[dict] = None,
) -> dict:
    """Run a full evaluation cycle.

    1. Load forecasts from TimescaleDB that are due for evaluation
    2. Load actuals from MySQL for the same time window
    3. Compute per-point and aggregate metrics
    4. Persist results
    """
    from src.config.settings import settings as app_settings

    dsn = timescale_dsn or app_settings.timescale_dsn
    if not dsn:
        return {"status": "skipped", "message": "No TimescaleDB DSN configured."}

    try:
        from psycopg import connect
        from psycopg.rows import dict_row

        cutoff = datetime.now(timezone.utc) - timedelta(hours=1)

        with connect(dsn, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                query = """
                    SELECT id, model_version, generated_at, forecast_at,
                           horizon_step, value AS predicted_value,
                           lower_bound, upper_bound
                    FROM forecast.humidity_forecasts
                    WHERE forecast_at <= %s
                      AND NOT EXISTS (
                        SELECT 1 FROM forecast.forecast_evaluations ev
                        WHERE ev.forecast_at = forecast.humidity_forecasts.forecast_at
                          AND ev.model_version = forecast.humidity_forecasts.model_version
                      )
                    ORDER BY forecast_at ASC
                    LIMIT 500
                """
                cur.execute(query, (cutoff,))
                forecasts = cur.fetchall()
    except Exception as exc:
        return {"status": "error", "message": f"Failed to query forecasts: {exc}"}

    if not forecasts:
        return {
            "status": "no_data",
            "message": "No forecasts pending evaluation.",
        }

    # Load actuals from MySQL
    actuals_raw = load_sensor_history(hours=lookback_hours)
    if actuals_raw.empty:
        return {"status": "skipped", "message": "No actual sensor data available."}

    actuals_raw["recorded_at"] = pd.to_datetime(actuals_raw["recorded_at"], utc=True)
    actuals_by_time = dict(
        zip(actuals_raw["recorded_at"], actuals_raw["humidity"])
    )

    # Match each forecast to its actual
    evaluation_rows = []
    for fc in forecasts:
        fc_time = fc["forecast_at"]
        if hasattr(fc_time, "tzinfo") and fc_time.tzinfo is None:
            fc_time = fc_time.replace(tzinfo=timezone.utc)

        actual = actuals_by_time.get(fc_time)
        if actual is None or np.isnan(actual):
            continue

        pred = fc["predicted_value"]
        evaluation_rows.append(
            {
                "model_version": fc["model_version"],
                "forecast_at": fc_time,
                "actual_value": float(actual),
                "predicted_value": float(pred),
                "absolute_error": float(abs(actual - pred)),
            }
        )

    if not evaluation_rows:
        return {
            "status": "no_match",
            "message": "No forecasts could be matched to actuals.",
        }

    # Persist per-point evaluations
    saved_count = save_evaluations(evaluation_rows, dsn)

    # Compute and persist aggregate metrics
    actual_vals = np.array([r["actual_value"] for r in evaluation_rows])
    pred_vals = np.array([r["predicted_value"] for r in evaluation_rows])
    metrics = _compute_metrics(actual_vals, pred_vals)

    # Save each aggregate metric to drift_metrics
    for metric_name in ["mae", "rmse", "mape", "bias"]:
        val = metrics.get(metric_name)
        if val is not None:
            save_drift_metric(
                metric_name=f"eval_{metric_name}_{model_version or 'gru-v0.1'}",
                metric_value=val,
                details={"samples": metrics["count"], "evaluated_at": datetime.utcnow().isoformat()},
                dsn=dsn,
            )

    return {
        "status": "success",
        "evaluations_written": saved_count,
        "samples": metrics["count"],
        "metrics": {k: v for k, v in metrics.items() if k != "count"},
    }
