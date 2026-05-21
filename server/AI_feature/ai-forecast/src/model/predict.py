"""Walk-forward (in-sample) and auto-regressive (future) prediction."""

import numpy as np
import pandas as pd
import torch

from src.config import settings
from src.data.sequences import minmax_norm, minmax_denorm
from src.model.gru import HumidityGRU
from src.model.train import load_model


def format_local_timestamp(value) -> str:
    ts = pd.Timestamp(value)
    if ts.tzinfo is not None:
        ts = ts.tz_convert(None)
    return ts.strftime("%Y-%m-%dT%H:%M:%S")


def build_model_from_artifact(artifact: dict) -> HumidityGRU:
    """Reconstruct model from saved artifact."""
    model = HumidityGRU(
        input_size=1,
        hidden_size=artifact.get("hidden_size", settings.hidden_size),
        num_layers=artifact.get("num_layers", settings.num_layers),
        dropout=artifact.get("dropout", settings.dropout),
    )
    model.load_state_dict(artifact["state_dict"])
    model.eval()
    return model


def generate_walkforward(
    df_resampled: pd.DataFrame,
    model: HumidityGRU,
    lookback: int,
    vmin: float,
    vmax: float,
    device: torch.device,
) -> list[dict]:
    """Walk-forward in-sample predictions.

    For each position i >= lookback, predict using [i-lookback, ..., i-1].
    Returns list of {timestamp, actual, predicted}.
    """
    vals = df_resampled["value"].values.astype(np.float32)
    timestamps = df_resampled["recorded_at"].values
    vals_norm = minmax_norm(vals, vmin, vmax)

    results = []
    for i in range(lookback, len(vals_norm)):
        context = vals_norm[i - lookback : i]  # (lookback,)
        inp = torch.from_numpy(context).float().view(1, lookback, 1).to(device)

        with torch.no_grad():
            pred_norm = model(inp).item()

        pred = float(minmax_denorm(pred_norm, vmin, vmax))
        actual = float(vals[i])

        results.append({
            "timestamp": format_local_timestamp(timestamps[i]),
            "actual": round(actual, 2),
            "predicted": round(pred, 2),
        })

    return results


def generate_future_forecast(
    df_resampled: pd.DataFrame,
    model: HumidityGRU,
    lookback: int,
    horizon_steps: int,
    vmin: float,
    vmax: float,
    interval_minutes: int,
    device: torch.device,
    mc_samples: int = 50,
) -> list[dict]:
    """Auto-regressive future forecast with MC Dropout confidence intervals.

    Starts from last lookback values, predicts horizon_steps ahead,
    feeding each prediction back as input.
    """
    vals = df_resampled["value"].values.astype(np.float32)
    vals_norm = minmax_norm(vals, vmin, vmax)

    context = list(vals_norm[-lookback:])
    last_ts = df_resampled["recorded_at"].iloc[-1]

    results = []
    for step in range(horizon_steps):
        inp = torch.tensor(context, dtype=torch.float32).view(1, lookback, 1).to(device)

        if mc_samples > 1:
            mc_preds = []
            model.train()
            with torch.no_grad():
                for _ in range(mc_samples):
                    mc_preds.append(model(inp).item())
            model.eval()
            pred_norm = float(np.mean(mc_preds))
            std_norm = float(np.std(mc_preds))
        else:
            with torch.no_grad():
                pred_norm = model(inp).item()
            std_norm = 0.0

        pred = float(minmax_denorm(pred_norm, vmin, vmax))
        pred = max(0.0, min(100.0, pred))

        std_val = float(std_norm * (vmax - vmin))
        lower = max(0.0, pred - 1.96 * std_val)
        upper = min(100.0, pred + 1.96 * std_val)

        # Confidence: 0.5-0.99, inversely related to relative uncertainty
        relative_uncertainty = std_val / (pred + 1e-6)
        confidence = max(0.5, min(0.99, 1.0 - relative_uncertainty * 2.0))

        next_ts = last_ts + pd.Timedelta(minutes=interval_minutes * (step + 1))

        results.append({
            "timestamp": format_local_timestamp(next_ts),
            "value": round(pred, 2),
            "lower": round(lower, 2),
            "upper": round(upper, 2),
            "confidence": round(confidence, 4),
        })

        context.pop(0)
        context.append(pred_norm)

    return results


def run_inference(
    df_resampled: pd.DataFrame,
    horizon_hours: int = 24,
    lookback: int | None = None,
) -> dict:
    """Full inference pipeline: walk-forward + future forecast.

    Parameters
    ----------
    df_resampled : DataFrame with columns [recorded_at, value], resampled
    horizon_hours : how many hours ahead to forecast
    lookback : how many past steps to use. Auto from artifact if None.

    Returns
    -------
    dict with keys: historical_predictions, predictions, data_summary
    """
    if df_resampled.empty or len(df_resampled) < 10:
        return {"historical_predictions": [], "predictions": [], "error": "Not enough data"}

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Detect interval from data
    deltas = df_resampled["recorded_at"].diff().dt.total_seconds().iloc[1:]
    median_interval_min = max(1, int(deltas.median() / 60)) if not deltas.empty else 15
    interval_minutes = median_interval_min

    if lookback is None:
        lookback = settings.lookback_steps

    horizon_steps = int(horizon_hours * 60 / interval_minutes)

    # Try loading trained model
    try:
        artifact = load_model(settings.model_path)
        model = build_model_from_artifact(artifact)
        model.to(device)
        vmin = artifact["vmin"]
        vmax = artifact["vmax"]
        model_lookback = artifact.get("lookback", lookback)
        trained = True
    except (FileNotFoundError, KeyError):
        # Fallback: naive seasonal (repeat last 24h pattern)
        vals = df_resampled["value"].values
        steps_per_day = int(24 * 60 / interval_minutes)
        pattern = vals[-steps_per_day:] if len(vals) >= steps_per_day else vals

        hist = _naive_walkforward(df_resampled, lookback, pattern)
        fut = _naive_forecast(df_resampled, horizon_steps, interval_minutes)
        return {
            "historical_predictions": hist,
            "predictions": fut,
            "fallback": True,
            "interval_minutes": interval_minutes,
        }

    if not trained:
        return {"historical_predictions": [], "predictions": [], "error": "No model available"}

    if len(df_resampled) < model_lookback:
        return {
            "historical_predictions": [],
            "predictions": [],
            "error": f"Need at least {model_lookback} contiguous points for GRU inference",
            "interval_minutes": interval_minutes,
        }

    # Walk-forward in-sample predictions
    if len(df_resampled) > model_lookback:
        historical = generate_walkforward(
            df_resampled, model, model_lookback, vmin, vmax, device
        )
    else:
        historical = []

    # Future forecast
    future = generate_future_forecast(
        df_resampled,
        model,
        model_lookback,
        horizon_steps,
        vmin,
        vmax,
        interval_minutes,
        device,
        mc_samples=settings.mc_dropout_samples,
    )

    return {
        "historical_predictions": historical,
        "predictions": future,
        "fallback": False,
        "interval_minutes": interval_minutes,
    }


def _naive_walkforward(
    df_resampled: pd.DataFrame,
    lookback: int,
    pattern: np.ndarray,
) -> list[dict]:
    """Fallback: repeat pattern for in-sample predictions."""
    vals = df_resampled["value"].values
    results = []
    for i in range(lookback, len(vals)):
        pat_idx = (i - lookback) % len(pattern)
        pred = float(pattern[pat_idx]) + float(np.random.normal(0, 0.02 * pattern[pat_idx]))
        results.append({
            "timestamp": format_local_timestamp(df_resampled["recorded_at"].iloc[i]),
            "actual": round(float(vals[i]), 2),
            "predicted": round(pred, 2),
        })
    return results


def _naive_forecast(
    df_resampled: pd.DataFrame,
    horizon_steps: int,
    interval_minutes: int,
) -> list[dict]:
    """Fallback: repeat last 24h pattern for future."""
    vals = df_resampled["value"].values
    last_ts = df_resampled["recorded_at"].iloc[-1]
    steps_per_day = int(24 * 60 / interval_minutes)
    pattern = vals[-steps_per_day:] if len(vals) >= steps_per_day else vals

    results = []
    for step in range(horizon_steps):
        base = float(pattern[step % len(pattern)])
        noise = float(np.random.normal(0, 0.02 * base))
        val = max(0, min(100, base + noise))
        next_ts = last_ts + pd.Timedelta(minutes=interval_minutes * (step + 1))
        results.append({
            "timestamp": format_local_timestamp(next_ts),
            "value": round(val, 2),
            "lower": round(max(0, val - 5), 2),
            "upper": round(min(100, val + 5), 2),
            "confidence": 0.5,
        })
    return results
