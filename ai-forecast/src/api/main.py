from fastapi import FastAPI
from src.api.routers.forecast import router as forecast_router
from src.api.routers.train import router as train_router
from src.api.routers.model_registry import router as model_registry_router
from src.api.routers.evaluation import router as evaluation_router
from src.api.routers.drift import router as drift_router
from src.api.routers.disease import router as disease_router
from src.config.settings import settings

app = FastAPI(title=settings.app_name)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "env": settings.app_env}


app.include_router(forecast_router, prefix="/forecast", tags=["forecast"])
app.include_router(train_router, prefix="/train", tags=["train"])
app.include_router(model_registry_router, prefix="/models", tags=["models"])
app.include_router(evaluation_router, prefix="/evaluate", tags=["evaluation"])
app.include_router(drift_router, prefix="/drift", tags=["drift"])
app.include_router(disease_router, prefix="", tags=["disease"])
