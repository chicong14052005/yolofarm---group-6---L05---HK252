from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.api.security import verify_service_token
from src.models.inference.predict import generate_forecast

router = APIRouter()


class ForecastRequest(BaseModel):
    sensor_type: str = Field(default="humidity")
    history_hours: int = Field(default=72, ge=24, le=720)
    horizon_hours: int = Field(default=24, ge=1, le=168)
    confidence_threshold: float = Field(default=0.7, ge=0.0, le=1.0)


class ForecastPoint(BaseModel):
    timestamp: str
    value: float
    lower: float
    upper: float
    confidence: float


class ForecastResponse(BaseModel):
    sensor_type: str
    horizon_hours: int
    generated_at: str
    model_version: str
    confidence: float
    predictions: List[ForecastPoint]


@router.post("/humidity", response_model=ForecastResponse)
def forecast_humidity(payload: ForecastRequest, _: None = Depends(verify_service_token)) -> ForecastResponse:
    predictions = generate_forecast(payload.horizon_hours)
    confidence = max(payload.confidence_threshold, 0.75)
    if predictions:
        confidence = max(
            confidence,
            sum(float(p.get("confidence", 0)) for p in predictions) / len(predictions),
        )

    return ForecastResponse(
        sensor_type=payload.sensor_type,
        horizon_hours=payload.horizon_hours,
        generated_at=datetime.utcnow().isoformat() + "Z",
        model_version="gru-v0.1",
        confidence=round(float(confidence), 4),
        predictions=predictions,
    )
