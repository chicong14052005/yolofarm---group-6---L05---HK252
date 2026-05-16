import os
from typing import Any

import pandas as pd
import mysql.connector


def _build_config_from_env() -> dict[str, Any]:
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "database": os.getenv("DB_NAME", "yolofarm"),
    }


def load_sensor_history(hours: int = 720) -> pd.DataFrame:
    """Load source sensor history from MySQL.

    This scaffold returns an empty frame when DB env is not configured.
    Replace with mysql connector implementation in production.
    """
    query = """
    SELECT
      DATE_FORMAT(recorded_at, '%%Y-%%m-%%d %%H:%%i:%%s') AS recorded_at,
      MAX(CASE WHEN sensor_type = 'humidity' THEN value END) AS humidity,
      MAX(CASE WHEN sensor_type = 'temperature' THEN value END) AS temperature,
      MAX(CASE WHEN sensor_type = 'soil_moisture' THEN value END) AS soil_moisture,
      MAX(CASE WHEN sensor_type = 'light' THEN value END) AS light
    FROM sensor_data
    WHERE recorded_at >= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR) - INTERVAL %s HOUR
    GROUP BY DATE_FORMAT(recorded_at, '%%Y-%%m-%%d %%H:%%i:00')
    ORDER BY recorded_at ASC
    """

    try:
        config = _build_config_from_env()
        conn = mysql.connector.connect(**config)
        cur = conn.cursor(dictionary=True)
        cur.execute(query, (hours,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        if not rows:
            return pd.DataFrame(columns=["recorded_at", "humidity", "temperature", "soil_moisture", "light"])

        frame = pd.DataFrame(rows)
        for col in ["humidity", "temperature", "soil_moisture", "light"]:
            frame[col] = pd.to_numeric(frame[col], errors="coerce")

        return frame
    except Exception:
        return pd.DataFrame(columns=["recorded_at", "humidity", "temperature", "soil_moisture", "light"])
