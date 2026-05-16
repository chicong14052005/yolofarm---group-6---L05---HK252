from fastapi import APIRouter, Depends

from src.api.security import verify_service_token
from src.monitoring.drift_monitor import run_drift_check

router = APIRouter()


@router.get("/latest")
def get_drift(_: None = Depends(verify_service_token)) -> dict:
    """Run all drift checks and return results."""
    return run_drift_check()


@router.get("/status")
def drift_status(_: None = Depends(verify_service_token)) -> dict:
    """Return recent drift metrics from the database (last 30 days)."""
    from src.config.settings import settings

    if not settings.timescale_dsn:
        return {"status": "no_db", "message": "No TimescaleDB configured."}

    try:
        from psycopg import connect
        from psycopg.rows import dict_row

        with connect(settings.timescale_dsn, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT metric_name, metric_value, observed_at, details
                    FROM forecast.drift_metrics
                    WHERE observed_at >= NOW() - INTERVAL '30 days'
                    ORDER BY observed_at DESC
                    LIMIT 100
                """
                )
                rows = cur.fetchall()

        return {"status": "ok", "metrics": rows}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
