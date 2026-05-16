"""Model drift monitoring.

Computes drift metrics by comparing recent prediction distributions and errors
against training-time baselines. Writes results to forecast.drift_metrics.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np

from src.config.settings import settings
from src.data.connectors.timescale_store import save_drift_metric


def _compute_psi(expected: np.ndarray, actual: np.ndarray, bins: int = 10) -> float:
    """Population Stability Index — measures distribution shift."""
    combined = np.concatenate([expected, actual])
    if combined.std() == 0:
        return 0.0
    min_val = combined.min()
    max_val = combined.max()
    if max_val == min_val:
        return 0.0
    edges = np.linspace(min_val, max_val, bins + 1)

    def _binned(seq):
        counts, _ = np.histogram(seq, bins=edges)
        return counts / max(len(seq), 1)

    p = _binned(expected) + 1e-6
    q = _binned(actual) + 1e-6

    return float(np.sum((p - q) * np.log(p / q)))


def _compute_js_divergence(p: np.ndarray, q: np.ndarray, bins: int = 10) -> float:
    """Jensen-Shannon Divergence — symmetric distribution comparison."""
    combined = np.concatenate([p, q])
    if combined.std() == 0:
        return 0.0
    min_val = combined.min()
    max_val = combined.max()
    if max_val == min_val:
        return 0.0
    edges = np.linspace(min_val, max_val, bins + 1)

    def _binned(seq):
        counts, _ = np.histogram(seq, bins=edges)
        return counts / max(len(seq), 1)

    p_bin = _binned(p) + 1e-6
    q_bin = _binned(q) + 1e-6
    m = 0.5 * (p_bin + q_bin)

    kl_pm = float(np.sum(p_bin * np.log(p_bin / m)))
    kl_qm = float(np.sum(q_bin * np.log(q_bin / m)))
    return 0.5 * (kl_pm + kl_qm)


def check_prediction_drift(
    recent_errors: list[float],
    baseline_mae: float,
    threshold_ratio: float = 1.5,
    dsn: Optional[str] = None,
) -> dict:
    """Check if recent prediction errors have drifted beyond threshold."""
    if not recent_errors:
        return {"drift_detected": False, "reason": "no_data"}

    recent_mae = float(np.mean(np.abs(recent_errors)))
    drift_ratio = recent_mae / max(baseline_mae, 1e-6)
    drifted = drift_ratio > threshold_ratio

    metric_value = round(drift_ratio, 4)
    save_drift_metric(
        metric_name="drift_error_ratio",
        metric_value=metric_value,
        details={
            "recent_mae": round(recent_mae, 4),
            "baseline_mae": round(baseline_mae, 4),
            "threshold_ratio": threshold_ratio,
            "samples": len(recent_errors),
        },
        dsn=dsn,
    )

    return {
        "drift_detected": drifted,
        "metric": "error_ratio",
        "value": metric_value,
        "threshold": threshold_ratio,
        "recent_mae": round(recent_mae, 4),
        "baseline_mae": round(baseline_mae, 4),
    }


def check_coverage_drift(
    in_bounds: int,
    total: int,
    expected_coverage: float = 0.95,
    dsn: Optional[str] = None,
) -> dict:
    """Check if the empirical coverage of confidence intervals has drifted."""
    if total == 0:
        return {"drift_detected": False, "reason": "no_data"}

    empirical_coverage = in_bounds / total
    coverage_drop = expected_coverage - empirical_coverage
    drifted = coverage_drop > 0.1  # >10% below expected coverage

    save_drift_metric(
        metric_name="drift_coverage",
        metric_value=round(empirical_coverage, 4),
        details={
            "expected_coverage": expected_coverage,
            "in_bounds": in_bounds,
            "total": total,
            "coverage_drop": round(coverage_drop, 4),
        },
        dsn=dsn,
    )

    return {
        "drift_detected": drifted,
        "metric": "coverage",
        "empirical_coverage": round(empirical_coverage, 4),
        "expected_coverage": expected_coverage,
        "coverage_drop": round(coverage_drop, 4),
    }


def run_drift_check(
    dsn: Optional[str] = None,
) -> dict:
    """Run all drift checks and return a summary.

    Queries recent evaluations from TimescaleDB and computes drift metrics.
    """
    dsn = dsn or settings.timescale_dsn
    if not dsn:
        return {"status": "skipped", "message": "No TimescaleDB configured."}

    try:
        from psycopg import connect
        from psycopg.rows import dict_row

        with connect(dsn, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                # Recent evaluations (last 7 days)
                cur.execute(
                    """
                    SELECT absolute_error, actual_value, predicted_value,
                           lower_bound, upper_bound, forecast_at
                    FROM forecast.forecast_evaluations ev
                    JOIN forecast.humidity_forecasts hf
                      ON ev.forecast_at = hf.forecast_at
                     AND ev.model_version = hf.model_version
                    WHERE ev.created_at >= NOW() - INTERVAL '7 days'
                    ORDER BY ev.created_at DESC
                """
                )
                rows = cur.fetchall()

                # Baseline MAE (from oldest 100 evaluations)
                cur.execute(
                    """
                    SELECT absolute_error
                    FROM forecast.forecast_evaluations
                    ORDER BY created_at ASC
                    LIMIT 100
                """
                )
                baseline_rows = cur.fetchall()
    except Exception as exc:
        return {"status": "error", "message": str(exc)}

    results = {"status": "ok", "checks": {}}

    if baseline_rows:
        baseline_mae = float(
            np.mean([abs(r["absolute_error"]) for r in baseline_rows])
        )
    else:
        baseline_mae = 5.0  # default fallback

    if rows:
        errors = [r["absolute_error"] for r in rows if r["absolute_error"] is not None]
        in_bounds = sum(
            1
            for r in rows
            if r["lower_bound"] is not None
            and r["upper_bound"] is not None
            and r["lower_bound"] <= r["actual_value"] <= r["upper_bound"]
        )

        results["checks"]["prediction_drift"] = check_prediction_drift(
            errors, baseline_mae, dsn=dsn
        )
        results["checks"]["coverage_drift"] = check_coverage_drift(
            in_bounds, len(rows), dsn=dsn
        )
    else:
        results["checks"]["prediction_drift"] = {
            "drift_detected": False,
            "reason": "no_recent_evaluations",
        }

    return results
