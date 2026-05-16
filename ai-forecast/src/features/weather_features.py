import pandas as pd


def add_covariates(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    frame = df.copy()
    for col in ["temperature", "soil_moisture", "light"]:
        if col not in frame.columns:
            frame[col] = 0.0
    return frame
