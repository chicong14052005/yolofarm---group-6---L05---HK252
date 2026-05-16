from datetime import datetime

from fastapi import APIRouter, Depends

from src.api.security import verify_service_token
from src.models.training.train_rnn import train_gru_baseline
from src.models.training.tune_rnn import hyperparameter_search

router = APIRouter()


@router.post("/humidity")
def train_humidity(_: None = Depends(verify_service_token)) -> dict:
    result = train_gru_baseline()
    return {
        "status": "started",
        "model": "gru",
        "result": result,
        "started_at": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/hyperparameter-search")
def tune_humidity(_: None = Depends(verify_service_token)) -> dict:
    results = hyperparameter_search()
    return {
        "status": "complete",
        "configs_tested": len(results),
        "best_config": results[0] if results else None,
        "all_results": results,
        "completed_at": datetime.utcnow().isoformat() + "Z",
    }
