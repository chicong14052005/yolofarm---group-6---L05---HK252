import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
FORECAST_DIR = BASE_DIR / "ai-forecast"

if str(FORECAST_DIR) not in sys.path:
    sys.path.insert(0, str(FORECAST_DIR))

from pest_detection.api.routes import get_model_status as get_pest_model_status
from pest_detection.api.routes import router as pest_detection_router
from src.api.routes import ForecastRequest, forecast_humidity
from src.api.routes import router as forecast_router
from src.config import settings as forecast_settings


app = FastAPI(
    title="YoloFarm AI API",
    description="Unified FastAPI app for YoloFarm pest detection and humidity forecasting.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pest_detection_router)
app.include_router(forecast_router)


class LegacyPredictionRequest(BaseModel):
    sensor_type: str = Field(default="humidity")
    hours: int = Field(default=24, ge=1, le=168)


@app.get("/")
def root():
    return {
        "service": "YoloFarm AI API",
        "docs": "/docs",
        "health": "/health",
        "models": "/models",
        "endpoints": [
            "POST /detect-disease",
            "POST /forecast/humidity",
            "POST /forecast/train",
        ],
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": {
            "pest_detection": get_pest_model_status(),
            "humidity_forecast": {
                "name": "Humidity forecast",
                "framework": "PyTorch",
                "artifact": str(forecast_settings.model_path),
                "artifact_exists": Path(forecast_settings.model_path).exists(),
                "endpoint": "POST /forecast/humidity",
            },
        },
    }


@app.get("/models")
def models():
    return {
        "models": [
            {
                **get_pest_model_status(),
                "input": {"file": "image/jpeg or image/png"},
                "output": ["disease_id", "disease_name", "treatment", "confidence"],
            },
            {
                "name": "Humidity forecast",
                "framework": "PyTorch",
                "artifact": str(forecast_settings.model_path),
                "artifact_exists": Path(forecast_settings.model_path).exists(),
                "endpoint": "POST /forecast/humidity",
                "input": {"history_hours": 720, "horizon_hours": 24, "lookback_hours": None},
                "output": ["historical_predictions", "predictions", "data_summary"],
            },
        ]
    }


@app.post("/predict", include_in_schema=False)
def legacy_predict(body: LegacyPredictionRequest):
    if body.sensor_type != "humidity":
        raise HTTPException(status_code=400, detail="Only humidity prediction is supported")

    return forecast_humidity(
        ForecastRequest(
            history_hours=720,
            horizon_hours=body.hours,
        )
    )
