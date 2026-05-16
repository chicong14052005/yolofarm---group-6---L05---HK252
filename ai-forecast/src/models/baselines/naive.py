"""Naive baseline models for forecast comparison.

Provides simple forecasting methods that the GRU should outperform.
Each baseline follows the same interface: generate_forecast(horizon_hours) -> list of points.
"""

from datetime import datetime, timedelta
from typing import Optional

import numpy as np

from src.data.pipelines.make_infer_dataset import make_infer_dataset


def persistence_forecast(horizon_hours: int = 24) -> list[dict]:
    """Persistence model: predict the last observed value for all future steps.

    forecast(t + k) = actual(t) for all k > 0
    """
    now = datetime.utcnow()
    features = make_infer_dataset(history_hours=max(72, horizon_hours + 24))

    base = float(features["humidity"].iloc[-1]) if not features.empty else 62.0

    predictions = []
    for step in range(1, horizon_hours + 1):
        forecasts_at = now + timedelta(hours=step)
        predictions.append(
            {
                "timestamp": forecasts_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "value": round(base, 2),
                "lower": max(0.0, round(base - 5.0, 2)),
                "upper": min(100.0, round(base + 5.0, 2)),
                "confidence": 0.6,
            }
        )
    return predictions


def seasonal_naive_forecast(horizon_hours: int = 24) -> list[dict]:
    """Seasonal naive model: predict value from 24 hours ago.

    forecast(t + k) = actual(t + k - 24)
    """
    now = datetime.utcnow()
    features = make_infer_dataset(history_hours=horizon_hours + 48)

    predictions = []
    humidity_series = features["humidity"].astype(float).tolist() if not features.empty else []

    for step in range(1, horizon_hours + 1):
        forecasts_at = now + timedelta(hours=step)
        # Look back 24 steps
        idx = -24 + step - 1
        if humidity_series and abs(idx) <= len(humidity_series):
            base = humidity_series[idx]
        else:
            base = 62.0

        predictions.append(
            {
                "timestamp": forecasts_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "value": round(base, 2),
                "lower": max(0.0, round(base - 6.0, 2)),
                "upper": min(100.0, round(base + 6.0, 2)),
                "confidence": 0.5,
            }
        )
    return predictions
