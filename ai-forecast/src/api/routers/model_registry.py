from fastapi import APIRouter, Depends

from src.api.security import verify_service_token

router = APIRouter()


@router.get("/latest")
def latest_model(_: None = Depends(verify_service_token)) -> dict:
    return {
        "model_version": "gru-v0.1",
        "status": "ready",
        "trained_at": None,
        "notes": "GRU scaffold is active. Run /train/humidity to produce latest artifact.",
    }
