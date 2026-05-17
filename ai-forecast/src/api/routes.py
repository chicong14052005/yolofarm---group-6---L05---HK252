"""FastAPI routes for humidity forecast."""

from datetime import datetime, timezone

import mysql.connector
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field

from src.config import settings
from src.data.loader import load_humidity_from_mysql
from src.data.resampler import analyze_gaps, resample_to_interval, split_at_large_gaps
from src.data.sequences import build_training_data
from src.model.predict import run_inference
from src.model.train import train_model, save_model

router = APIRouter(prefix="/forecast", tags=["forecast"])


# ── Request / Response models ──────────────────────────────────────────

class ForecastRequest(BaseModel):
    history_hours: int = Field(default=720, ge=1, le=2160)
    horizon_hours: int = Field(default=24, ge=1, le=168)
    lookback_hours: int | None = Field(default=None, ge=1, le=168)


class HistoricalPoint(BaseModel):
    timestamp: str
    actual: float
    predicted: float


class ForecastPoint(BaseModel):
    timestamp: str
    value: float
    lower: float
    upper: float
    confidence: float


class DataSummary(BaseModel):
    total_records: int
    median_interval_s: float
    gaps_above_2x: int
    resampled_interval_min: int
    coverage_pct: float
    n_sequences: int


class ForecastResponse(BaseModel):
    sensor_type: str = "humidity"
    horizon_hours: int
    interval_minutes: int
    model_version: str
    generated_at: str
    data_summary: DataSummary | None = None
    historical_predictions: list[HistoricalPoint] = []
    predictions: list[ForecastPoint] = []
    fallback: bool = False
    error: str | None = None


class TrainRequest(BaseModel):
    history_hours: int = Field(default=720, ge=24, le=2160)
    retrain: bool = Field(default=False)


class TrainResponse(BaseModel):
    status: str
    model_version: str
    n_sequences: int
    val_loss: float | None = None
    fallback: bool = False


# ── Auth helper ────────────────────────────────────────────────────────

def verify_token(authorization: str | None = None) -> None:
    if not settings.api_token:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.removeprefix("Bearer ").strip()
    if token != settings.api_token:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Routes ─────────────────────────────────────────────────────────────

@router.post("/humidity", response_model=ForecastResponse)
def forecast_humidity(
    body: ForecastRequest,
    authorization: str | None = Header(None),
):
    verify_token(authorization)

    try:
        df = load_humidity_from_mysql(hours=body.history_hours)
    except mysql.connector.Error as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")

    if df.empty:
        return ForecastResponse(
            horizon_hours=body.horizon_hours,
            interval_minutes=15,
            model_version="none",
            generated_at=datetime.now(timezone.utc).isoformat(),
            error="No humidity data found in the requested window",
        )

    # Gap analysis
    gap_info = analyze_gaps(df)
    interval_min = gap_info["recommended_interval_min"]

    # Resample
    df_resampled = resample_to_interval(df, interval_minutes=interval_min)

    if df_resampled.empty or len(df_resampled) < 10:
        return ForecastResponse(
            horizon_hours=body.horizon_hours,
            interval_minutes=interval_min,
            model_version="none",
            generated_at=datetime.now(timezone.utc).isoformat(),
            error="Too few data points after resampling",
        )

    # Determine lookback in steps
    if body.lookback_hours:
        lookback = int(body.lookback_hours * 60 / interval_min)
    else:
        lookback = settings.lookback_steps

    lookback = max(1, min(lookback, len(df_resampled) // 2))

    sequences = split_at_large_gaps(df_resampled, interval_min)

    # Run inference
    result = run_inference(
        df_resampled,
        horizon_hours=body.horizon_hours,
        lookback=lookback,
    )

    return ForecastResponse(
        horizon_hours=body.horizon_hours,
        interval_minutes=result.get("interval_minutes", interval_min),
        model_version="gru-v2" if not result.get("fallback") else "fallback-seasonal",
        generated_at=datetime.now(timezone.utc).isoformat(),
        data_summary=DataSummary(
            total_records=gap_info["n_records"],
            median_interval_s=gap_info["median_interval_s"],
            gaps_above_2x=gap_info["gaps_above_2x"],
            resampled_interval_min=interval_min,
            coverage_pct=gap_info["coverage_pct"],
            n_sequences=len(sequences),
        ),
        historical_predictions=[
            HistoricalPoint(**p) for p in result.get("historical_predictions", [])
        ],
        predictions=[
            ForecastPoint(**p) for p in result.get("predictions", [])
        ],
        fallback=result.get("fallback", False),
        error=result.get("error"),
    )


@router.post("/train", response_model=TrainResponse)
def train_humidity(
    body: TrainRequest,
    authorization: str | None = Header(None),
):
    """Train a new GRU model on historical humidity data."""
    verify_token(authorization)

    try:
        df = load_humidity_from_mysql(hours=body.history_hours)
    except mysql.connector.Error as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")

    if df.empty:
        raise HTTPException(status_code=400, detail="No humidity data available for training")

    gap_info = analyze_gaps(df)
    interval_min = gap_info["recommended_interval_min"]

    df_resampled = resample_to_interval(df, interval_minutes=interval_min)
    sequences = split_at_large_gaps(df_resampled, interval_min)

    lookback = min(settings.lookback_steps, len(df_resampled) // 4)
    lookback = max(4, lookback)

    X, y, vmin, vmax = build_training_data(sequences, lookback)

    if len(X) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"Only {len(X)} training sequences — need at least 10",
        )

    model = train_model(X, y, val_split=0.2)
    save_model(model, settings.model_path, {
        "lookback": lookback,
        "vmin": vmin,
        "vmax": vmax,
        "n_sequences": len(X),
        "interval_minutes": interval_min,
    })

    return TrainResponse(
        status="ok",
        model_version="gru-v2",
        n_sequences=len(X),
    )
