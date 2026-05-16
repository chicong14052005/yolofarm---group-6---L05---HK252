import pandas as pd

from src.data.pipelines.build_features import preprocess


def test_preprocess_builds_features() -> None:
    df = pd.DataFrame(
        {
            "recorded_at": pd.date_range("2026-01-01", periods=40, freq="h"),
            "humidity": [60 + (i % 5) for i in range(40)],
            "temperature": [28.0] * 40,
            "soil_moisture": [35.0] * 40,
            "light": [12000.0] * 40,
        }
    )

    out = preprocess(df)
    assert not out.empty
    assert "humidity_lag_24" in out.columns
    assert "hour" in out.columns
    assert "humidity_roll_mean_6" in out.columns
