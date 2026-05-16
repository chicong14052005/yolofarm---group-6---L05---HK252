from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import torch
from torch import nn

from src.config.settings import settings
from src.data.connectors.timescale_store import save_feature_rows
from src.data.pipelines.make_infer_dataset import make_infer_dataset


def _build_gru_regressor(
    input_size: int, hidden_size: int, num_layers: int, dropout: float = 0.0
):
    gru = nn.GRU(
        input_size=input_size,
        hidden_size=hidden_size,
        num_layers=num_layers,
        dropout=dropout if num_layers > 1 else 0.0,
        batch_first=True,
    )
    head = nn.Sequential(
        nn.Dropout(p=dropout),
        nn.Linear(hidden_size, 1),
    )
    return gru, head


def _load_checkpoint_weights(gru: nn.GRU, head: nn.Sequential, artifact: dict) -> None:
    if "gru_state_dict" in artifact and "head_state_dict" in artifact:
        gru.load_state_dict(artifact["gru_state_dict"])
        head.load_state_dict(artifact["head_state_dict"])
        return

    state_dict = artifact.get("state_dict", {})
    if state_dict:
        gru_state = {
            k.replace("gru.", ""): v
            for k, v in state_dict.items()
            if k.startswith("gru.")
        }
        head_state = {
            k.replace("fc.", ""): v
            for k, v in state_dict.items()
            if k.startswith("fc.")
        }
        if gru_state:
            gru.load_state_dict(gru_state)
        if head_state:
            head.load_state_dict(head_state)


def _reconstruct_feature_row(
    history_humidity: list,
    predictions: list,
    feature_columns: list,
    last_covariates: dict,
    forecast_timestamp: datetime,
):
    """Build a feature vector for one auto-regressive step.

    Reconstructs features that during training came from lag/rolling/time transforms
    so the multivariate model receives the same inputs at inference time.
    """
    all_values = history_humidity + predictions

    # Forward fill covariates from last observed
    temperature = last_covariates.get("temperature", 0.0)
    soil_moisture = last_covariates.get("soil_moisture", 0.0)
    light = last_covariates.get("light", 0.0)

    # Time features from the forecast timestamp
    hour = forecast_timestamp.hour
    day_of_week = forecast_timestamp.weekday()
    is_weekend = 1 if day_of_week >= 5 else 0

    # Current humidity = last known/predicted value
    current_humidity = all_values[-1] if all_values else 60.0

    # Lags: look back in the combined history + predictions
    def _lag(k):
        if k <= len(all_values):
            return all_values[-k]
        return all_values[0] if all_values else current_humidity

    # Rolling window (last 6 values)
    window = all_values[-6:] if len(all_values) >= 6 else all_values
    roll_mean_6 = float(np.mean(window)) if window else current_humidity
    roll_std_6 = float(np.std(window)) if window else 0.0

    # Build feature vector matching the training column order
    feature_map = {
        "humidity": current_humidity,
        "temperature": temperature,
        "soil_moisture": soil_moisture,
        "light": light,
        "hour": hour,
        "day_of_week": day_of_week,
        "is_weekend": is_weekend,
        "humidity_lag_1": _lag(1),
        "humidity_lag_3": _lag(3),
        "humidity_lag_6": _lag(6),
        "humidity_lag_12": _lag(12),
        "humidity_lag_24": _lag(24),
        "humidity_roll_mean_6": roll_mean_6,
        "humidity_roll_std_6": roll_std_6,
    }

    return np.array([feature_map[c] for c in feature_columns], dtype=np.float32)


def generate_forecast(
    horizon_hours: int, num_mc_samples: int = 50
) -> list:
    now = datetime.utcnow()
    features = make_infer_dataset(history_hours=max(72, horizon_hours + 24))
    predictions = []

    model_path = Path(settings.model_path)
    if model_path.exists() and not features.empty:
        artifact = torch.load(model_path, map_location="cpu")
        feature_columns = artifact.get("feature_columns", [])
        input_size = artifact.get("input_size", 1)
        hidden_size = artifact.get("hidden_size", 64)
        num_layers = artifact.get("num_layers", 2)
        lookback = int(artifact.get("lookback", 24))
        min_vals = np.array(artifact["min_vals"], dtype=np.float32)
        max_vals = np.array(artifact["max_vals"], dtype=np.float32)
        ranges = max_vals - min_vals
        ranges[ranges == 0] = 1.0
        humidity_idx = int(artifact.get("humidity_idx", 0))

        # Extract history from the preprocessed DataFrame
        raw_humidity = features["humidity"].astype(float).tolist()

        # Forward-fill covariates from the last observed row
        last_covariates = {
            k: float(features[k].iloc[-1])
            for k in ["temperature", "soil_moisture", "light"]
        }

        # History sequence for the GRU lookback window
        history_seq = features[feature_columns].astype(float).values
        if len(history_seq) < lookback:
            history_seq = np.pad(
                history_seq,
                ((lookback - len(history_seq), 0), (0, 0)),
                mode="edge",
            )

        # Build the initial normalized window from history
        window_normalized = (history_seq[-lookback:] - min_vals) / ranges

        gru, head = _build_gru_regressor(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=0.2,
        )
        _load_checkpoint_weights(gru, head, artifact)
        gru.eval()
        head.eval()

        # Track all predictions for lag/rolling feature reconstruction
        all_predictions = []
        all_denormalized = []

        for step in range(1, horizon_hours + 1):
            forecast_ts = now + timedelta(hours=step)

            if step == 1:
                # Use the last lookback window from history
                norm_window = window_normalized.copy()
            else:
                # Rebuild feature vector for the current step
                feature_vec = _reconstruct_feature_row(
                    history_humidity=raw_humidity,
                    predictions=[v["value"] for v in all_denormalized],
                    feature_columns=feature_columns,
                    last_covariates=last_covariates,
                    forecast_timestamp=forecast_ts,
                )
                norm_vector = (feature_vec - min_vals) / ranges
                # Roll the window: drop oldest, append newest
                norm_window = np.vstack([norm_window[1:], norm_vector])

            x = torch.from_numpy(norm_window).float().unsqueeze(0)  # (1, lookback, n_features)

            # MC Dropout: run multiple forward passes with dropout enabled
            gru.train()
            head.train()
            mc_samples = []
            with torch.no_grad():
                for _ in range(num_mc_samples):
                    out, _ = gru(x)
                    pred = head(out[:, -1, :])
                    mc_samples.append(pred.item())

            # Aggregate MC samples
            mc_mean = float(np.mean(mc_samples))
            mc_std = float(np.std(mc_samples))

            # Denormalize the prediction
            raw_value = mc_mean * ranges[humidity_idx] + min_vals[humidity_idx]
            raw_value = max(0.0, min(100.0, raw_value))

            # Derive bounds in normalized space, then denormalize
            raw_lower = (mc_mean - 1.96 * mc_std) * ranges[humidity_idx] + min_vals[humidity_idx]
            raw_upper = (mc_mean + 1.96 * mc_std) * ranges[humidity_idx] + min_vals[humidity_idx]
            raw_lower = max(0.0, min(100.0, raw_lower))
            raw_upper = max(0.0, min(100.0, raw_upper))

            # Confidence score: lower std / wider range = less confident
            normalized_range = ranges[humidity_idx] if ranges[humidity_idx] > 0 else 1.0
            confidence_score = max(0.5, min(0.99, 1.0 - mc_std * 2.0))
            confidence_score = round(confidence_score, 4)

            point = {
                "timestamp": forecast_ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "value": round(raw_value, 2),
                "lower": round(raw_lower, 2),
                "upper": round(raw_upper, 2),
                "confidence": confidence_score,
            }
            all_denormalized.append(point)
            all_predictions.append(raw_value)
            predictions.append(point)

    else:
        # Fallback: linear decay when no model artifact exists
        base = float(features["humidity"].iloc[-1]) if not features.empty else 62.0
        for step in range(1, horizon_hours + 1):
            value = max(5.0, min(100.0, base - 0.05 * step))
            lower = max(0.0, value - 4.0)
            upper = min(100.0, value + 4.0)
            predictions.append(
                {
                    "timestamp": (now + timedelta(hours=step)).isoformat() + "Z",
                    "value": round(value, 2),
                    "lower": round(lower, 2),
                    "upper": round(upper, 2),
                    "confidence": 0.75,
                }
            )

    # Best-effort persistence to forecast DB
    persistence_rows = [
        {
            "model_version": "gru-v0.1",
            "generated_at": now.isoformat() + "Z",
            "forecast_at": point["timestamp"],
            "horizon_step": idx + 1,
            "value": point["value"],
            "lower_bound": point["lower"],
            "upper_bound": point["upper"],
            "confidence": point["confidence"],
        }
        for idx, point in enumerate(predictions)
    ]
    save_feature_rows(persistence_rows)

    return predictions
