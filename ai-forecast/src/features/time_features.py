import pandas as pd


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    frame = df.copy()
    frame["recorded_at"] = pd.to_datetime(frame["recorded_at"], utc=True)
    frame["hour"] = frame["recorded_at"].dt.hour
    frame["day_of_week"] = frame["recorded_at"].dt.dayofweek
    frame["is_weekend"] = frame["day_of_week"].isin([5, 6]).astype(int)
    return frame
