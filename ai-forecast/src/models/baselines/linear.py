"""Linear regression baseline using the same feature set as GRU.

If a linear model performs nearly as well as the GRU, the extra complexity
of the recurrent architecture is not justified for this dataset.
"""

from datetime import datetime, timedelta
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import LinearRegression

from src.config.settings import settings
from src.data.pipelines.make_train_dataset import make_train_dataset
from src.data.pipelines.make_infer_dataset import make_infer_dataset
from src.models.training.train_rnn import _get_feature_columns


_LINEAR_ARTIFACT_PATH = "artifacts/models/linear_baseline.joblib"


def train_linear_baseline() -> dict:
    """Train a linear regression model on the same feature set."""
    df = make_train_dataset(hours=720)
    if df.empty or "humidity" not in df.columns:
        return {"status": "skipped", "message": "No training data."}

    feature_columns = _get_feature_columns(df)
    feature_data = df[feature_columns].astype(float).values
    target_data = df["humidity"].astype(float).values

    model = LinearRegression()
    model.fit(feature_data, target_data)

    artifact_path = Path(_LINEAR_ARTIFACT_PATH)
    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "feature_columns": feature_columns,
            "train_score": float(model.score(feature_data, target_data)),
        },
        artifact_path,
    )

    return {
        "status": "trained",
        "model": "linear_regression",
        "artifact": str(artifact_path),
        "r2_score": round(float(model.score(feature_data, target_data)), 4),
        "features": len(feature_columns),
    }


def linear_forecast(horizon_hours: int = 24) -> list[dict]:
    """Generate forecast using linear regression with feature reconstruction."""
    now = datetime.utcnow()
    features = make_infer_dataset(history_hours=max(72, horizon_hours + 24))

    artifact_path = Path(_LINEAR_ARTIFACT_PATH)
    if not artifact_path.exists() or features.empty:
        # Fall back to persistence
        from src.models.baselines.naive import persistence_forecast

        return persistence_forecast(horizon_hours)

    artifact = joblib.load(artifact_path)
    model = artifact["model"]
    feature_columns = artifact["feature_columns"]

    raw_humidity = features["humidity"].astype(float).tolist()
    predictions = []
    last_covariates = {
        k: float(features[k].iloc[-1])
        for k in ["temperature", "soil_moisture", "light"]
        if k in features.columns
    }

    # Reconstruct features for each step and predict directly
    all_values = list(raw_humidity)

    for step in range(1, horizon_hours + 1):
        forecast_ts = now + timedelta(hours=step)

        current_humidity = all_values[-1] if all_values else 60.0

        def _lag(k):
            if k <= len(all_values):
                return all_values[-k]
            return all_values[0] if all_values else current_humidity

        window = all_values[-6:] if len(all_values) >= 6 else all_values
        roll_mean_6 = float(np.mean(window)) if window else current_humidity
        roll_std_6 = float(np.std(window)) if window else 0.0

        feature_map = {
            "humidity": current_humidity,
            "temperature": last_covariates.get("temperature", 0.0),
            "soil_moisture": last_covariates.get("soil_moisture", 0.0),
            "light": last_covariates.get("light", 0.0),
            "hour": forecast_ts.hour,
            "day_of_week": forecast_ts.weekday(),
            "is_weekend": 1 if forecast_ts.weekday() >= 5 else 0,
            "humidity_lag_1": _lag(1),
            "humidity_lag_3": _lag(3),
            "humidity_lag_6": _lag(6),
            "humidity_lag_12": _lag(12),
            "humidity_lag_24": _lag(24),
            "humidity_roll_mean_6": roll_mean_6,
            "humidity_roll_std_6": roll_std_6,
        }

        x = np.array([[feature_map[c] for c in feature_columns]], dtype=np.float32)
        pred = float(model.predict(x)[0])
        pred = max(0.0, min(100.0, pred))
        all_values.append(pred)

        predictions.append(
            {
                "timestamp": forecast_ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "value": round(pred, 2),
                "lower": max(0.0, round(pred - 4.0, 2)),
                "upper": min(100.0, round(pred + 4.0, 2)),
                "confidence": 0.65,
            }
        )

    return predictions
