from fastapi import APIRouter, Depends, Query

from src.api.security import verify_service_token
from src.models.evaluation.evaluator import run_evaluation

router = APIRouter()


@router.post("/run")
def trigger_evaluation(
    lookback_hours: int = Query(48, description="Hours of actual data to check"),
    _: None = Depends(verify_service_token),
) -> dict:
    """Trigger a manual evaluation cycle. Compares recent forecasts against actuals."""
    result = run_evaluation(lookback_hours=lookback_hours)
    return result


@router.get("/latest")
def latest_evaluation(
    _: None = Depends(verify_service_token),
) -> dict:
    """Return the most recent evaluation metrics from drift_metrics."""
    dsn = None
    try:
        from src.config.settings import settings as app_settings

        dsn = app_settings.timescale_dsn
        if not dsn:
            return {"status": "no_db", "message": "No TimescaleDB configured."}

        from psycopg import connect
        from psycopg.rows import dict_row

        with connect(dsn, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT metric_name, metric_value, observed_at, details
                    FROM forecast.drift_metrics
                    WHERE metric_name LIKE 'eval_%%'
                      AND observed_at >= NOW() - INTERVAL '7 days'
                    ORDER BY observed_at DESC
                    LIMIT 20
                """
                )
                rows = cur.fetchall()

        return {
            "status": "ok",
            "metrics": rows,
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
