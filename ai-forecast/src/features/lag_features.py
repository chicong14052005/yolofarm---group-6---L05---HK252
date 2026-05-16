import pandas as pd


def add_lag_features(df: pd.DataFrame, lags: tuple[int, ...] = (1, 3, 6, 12, 24)) -> pd.DataFrame:
    if df.empty:
        return df

    frame = df.copy()
    for lag in lags:
        frame[f"humidity_lag_{lag}"] = frame["humidity"].shift(lag)

    frame["humidity_roll_mean_6"] = frame["humidity"].rolling(6).mean()
    frame["humidity_roll_std_6"] = frame["humidity"].rolling(6).std()
    return frame
