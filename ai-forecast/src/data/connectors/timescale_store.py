from datetime import datetime
from typing import Iterable, Mapping, Optional

from psycopg import connect
from psycopg.rows import dict_row

from src.config.settings import settings


def save_feature_rows(rows: Iterable[Mapping]) -> int:
    """Persist feature rows to TimescaleDB.

    Placeholder returns 0 while storage integration is being wired.
    """
    payload = list(rows)
    if not payload:
        return 0

    if not settings.timescale_dsn:
        return 0

    sql = """
    INSERT INTO forecast.humidity_forecasts (
      model_version,
      generated_at,
      forecast_at,
      horizon_step,
      value,
      lower_bound,
      upper_bound,
      confidence
    ) VALUES (
      %(model_version)s,
      %(generated_at)s,
      %(forecast_at)s,
      %(horizon_step)s,
      %(value)s,
      %(lower_bound)s,
      %(upper_bound)s,
      %(confidence)s
    )
    """

    try:
        with connect(settings.timescale_dsn, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.executemany(sql, payload)
            conn.commit()
        return len(payload)
    except Exception:
        return 0


def save_evaluations(rows: Iterable[Mapping], dsn: Optional[str] = None) -> int:
    """Persist forecast evaluation results to the forecast_evaluations table."""
    payload = list(rows)
    if not payload:
        return 0

    dsn = dsn or settings.timescale_dsn
    if not dsn:
        return 0

    sql = """
    INSERT INTO forecast.forecast_evaluations (
      model_version,
      forecast_at,
      actual_value,
      predicted_value,
      absolute_error
    ) VALUES (
      %(model_version)s,
      %(forecast_at)s,
      %(actual_value)s,
      %(predicted_value)s,
      %(absolute_error)s
    )
    """

    try:
        with connect(dsn, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.executemany(sql, payload)
            conn.commit()
        return len(payload)
    except Exception:
        return 0


def save_drift_metric(
    metric_name: str,
    metric_value: float,
    details: Optional[dict] = None,
    dsn: Optional[str] = None,
) -> bool:
    """Persist a single drift metric to the drift_metrics table."""
    dsn = dsn or settings.timescale_dsn
    if not dsn:
        return False

    sql = """
    INSERT INTO forecast.drift_metrics (metric_name, metric_value, details)
    VALUES (%s, %s, %s)
    """

    try:
        import json

        with connect(dsn, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (metric_name, metric_value, json.dumps(details or {})))
            conn.commit()
        return True
    except Exception:
        return False
