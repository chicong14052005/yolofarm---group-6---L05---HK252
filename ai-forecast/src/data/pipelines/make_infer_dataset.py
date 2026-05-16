import pandas as pd

from src.data.connectors.mysql_source import load_sensor_history
from src.data.pipelines.build_features import preprocess, PIPELINE_VERSION


def make_infer_dataset(history_hours: int = 72) -> pd.DataFrame:
    raw = load_sensor_history(hours=history_hours)
    features = preprocess(raw)
    features["pipeline_version"] = PIPELINE_VERSION
    return features
