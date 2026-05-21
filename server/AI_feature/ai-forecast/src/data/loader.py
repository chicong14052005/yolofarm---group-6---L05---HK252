"""Load humidity records from MySQL sensor_data or from a JSON list."""

import json
from typing import Optional

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

from src.config import settings

LOCAL_TZ_OFFSET_HOURS = 7


def _get_engine():
    url = f"mysql+mysqlconnector://{settings.db_user}:{settings.db_password}@{settings.db_host}:{settings.db_port}/{settings.db_name}"
    return create_engine(url)


def _parse_mysql_local_timestamp(series: pd.Series) -> pd.Series:
    """Parse DB timestamps as local wall-clock datetimes.

    The Node backend writes sensor_data.recorded_at as Vietnam local time by
    using UTC_TIMESTAMP() + 7 hours. Treating those values as UTC makes every
    forecast point render seven hours late in the browser.
    """
    parsed = pd.to_datetime(series, errors="coerce")
    if getattr(parsed.dt, "tz", None) is not None:
        parsed = parsed.dt.tz_localize(None)
    return parsed


def _parse_utc_json_timestamp(series: pd.Series) -> pd.Series:
    parsed = pd.to_datetime(series, errors="coerce", utc=True)
    return parsed.dt.tz_convert(None) + pd.Timedelta(hours=LOCAL_TZ_OFFSET_HOURS)


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

    df["recorded_at"] = _parse_mysql_local_timestamp(df["recorded_at"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce").astype(np.float32)
    df = df.dropna(subset=["recorded_at", "value"])
    df = df.sort_values("recorded_at")
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

    df["recorded_at"] = _parse_utc_json_timestamp(df["recorded_at"])
    df["value"] = df["value"].astype(np.float32)
    df = df.dropna(subset=["recorded_at", "value"])
    df = df.sort_values("recorded_at").reset_index(drop=True)
    return df


def load_humidity_from_json_file(path: str) -> pd.DataFrame:
    """Load humidity records from a JSON file on disk."""
    with open(path) as f:
        data = json.load(f)
    return load_humidity_from_json(data)
