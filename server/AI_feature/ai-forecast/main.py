"""FastAPI app entry point for YoloFarm AI Forecast."""

from fastapi import FastAPI

from src.api.routes import router as forecast_router
from src.config import settings

app = FastAPI(title=settings.app_name)


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}


app.include_router(forecast_router)
