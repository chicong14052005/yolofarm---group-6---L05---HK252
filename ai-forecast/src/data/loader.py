"""Load humidity records from MySQL sensor_data or from a JSON list."""

import json
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

from src.config import settings


def _get_engine():
    url = f"mysql+mysqlconnector://{settings.db_user}:{settings.db_password}@{settings.db_host}:{settings.db_port}/{settings.db_name}"
    return create_engine(url)


def load_humidity_from_mysql(
    hours: Optional[int] = None,
    timezone_offset: int = 7,
) -> pd.DataFrame:
    """Fetch humidity records from MySQL sensor_data table.

    Returns a DataFrame with columns [recorded_at, value], sorted ascending.
    Data is pre-sorted by the query (ORDER BY recorded_at ASC).
    """
    if hours is None:
        hours = settings.history_hours_default

    query = """
        SELECT recorded_at, value
        FROM sensor_data
        WHERE sensor_type = 'humidity'
          AND recorded_at >= DATE_ADD(
              DATE_SUB(UTC_TIMESTAMP(), INTERVAL :hours HOUR),
              INTERVAL :tz_offset HOUR
          )
        ORDER BY recorded_at ASC
    """

    engine = _get_engine()
    with engine.connect() as conn:
        df = pd.read_sql(text(query), conn, params={"hours": hours, "tz_offset": timezone_offset})

    if df.empty:
        return pd.DataFrame(columns=["recorded_at", "value"])

    df["recorded_at"] = pd.to_datetime(df["recorded_at"], utc=True)
    df["value"] = pd.to_numeric(df["value"], errors="coerce").astype(np.float32)
    df = df.dropna(subset=["value"])
    df = df.reset_index(drop=True)
    return df


def load_humidity_from_json(data: list[dict]) -> pd.DataFrame:
    """Load humidity records from a parsed JSON array.

    Expects each entry: {"created_at": "ISO8601", "value": "str_or_num", ...}
    Returns DataFrame with columns [recorded_at, value], already sorted.
    """
    records = []
    for entry in data:
        ts_str = entry.get("created_at") or entry.get("recorded_at")
        if not ts_str:
            continue
        val = float(entry["value"])
        records.append({"recorded_at": ts_str, "value": val})

    df = pd.DataFrame(records)
    if df.empty:
        return df

    df["recorded_at"] = pd.to_datetime(df["recorded_at"], utc=True)
    df["value"] = df["value"].astype(np.float32)
    return df


def load_humidity_from_json_file(path: str) -> pd.DataFrame:
    """Load humidity records from a JSON file on disk."""
    with open(path) as f:
        data = json.load(f)
    return load_humidity_from_json(data)
