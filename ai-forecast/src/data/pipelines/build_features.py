import pandas as pd

from src.features.lag_features import add_lag_features
from src.features.time_features import add_time_features
from src.features.weather_features import add_covariates

PIPELINE_VERSION = "v1"


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """Preprocessing contract for both training and inference.

    Rules:
    - Parse timestamps
    - Fill missing humidity with forward fill then median fallback
    - Clip humidity to physical range [0, 100]
    - Add lag/rolling/time/covariate features
    """
    if df.empty:
        return df

    frame = df.copy()
    frame["recorded_at"] = pd.to_datetime(frame["recorded_at"], utc=True)
    frame = frame.sort_values("recorded_at")

    frame["humidity"] = frame["humidity"].ffill()
    frame["humidity"] = frame["humidity"].fillna(frame["humidity"].median())
    frame["humidity"] = frame["humidity"].clip(lower=0, upper=100)

    frame = add_covariates(frame)
    frame = add_time_features(frame)
    frame = add_lag_features(frame)

    return frame.dropna().reset_index(drop=True)
