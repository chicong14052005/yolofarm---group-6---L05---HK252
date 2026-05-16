# AI Forecast Service

Python FastAPI service for humidity forecasting in YoloFarm smart farming platform.

## Architecture Overview

```
Node.js (Express) ──HTTP──▶ Python FastAPI ──SQL──▶ MySQL (sensor history)
                                   │                      │
                                   │                      │
                              ┌────┴────┐       TimescaleDB (forecast DB)
                              │  GRU v2 │
                              └─────────┘
```

- **GRU v2**: Multivariate (14 features) with Monte Carlo Dropout uncertainty
- **Feature pipeline**: Lags, rolling stats, time features, covariates
- **Alert system**: Threshold-based with debounce, real-time Socket.IO push
- **Evaluation**: Auto-compares forecasts against actuals, tracks drift

## Quick Start

```bash
cd ai-forecast
cp .env.example .env
pip install -e .
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
| POST | `/forecast/humidity` | Generate humidity forecast |
| POST | `/train/humidity` | Train GRU model on latest 30 days |
| POST | `/train/hyperparameter-search` | Grid search over model configs |
| GET | `/models/latest` | Current model metadata |
| POST | `/evaluate/run` | Manual evaluation cycle |
| GET | `/evaluate/latest` | Latest evaluation metrics |
| GET | `/drift/latest` | Run drift checks |
| GET | `/drift/status` | Drift metrics history (30 days) |
| POST | `/detect-disease` | Disease detection (placeholder) |

All endpoints except `/health` require `Authorization: Bearer <token>` when `AI_SERVICE_TOKEN` is set.

## Forecast API

```json
POST /forecast/humidity
{
  "sensor_type": "humidity",
  "history_hours": 72,
  "horizon_hours": 24,
  "confidence_threshold": 0.7
}
```

Returns multivariate GRU forecast with Monte Carlo Dropout-derived confidence intervals (95% CI from 50 forward passes). Falls back to linear decay when no model artifact exists.

## Model Architecture

- **Input**: 14 features — humidity, temperature, soil_moisture, light, lags (1/3/6/12/24h), rolling mean/std (6h), hour, day_of_week, is_weekend
- **Encoder**: 2-layer GRU (`hidden_size=64`, `dropout=0.2`)
- **Head**: `Dropout(0.2) → Linear(64, 1)`
- **Uncertainty**: MC Dropout with 50 forward passes → 95% CI
- **Training**: Temporal 80/20 split, early stopping (patience=10), ReduceLROnPlateau, gradient clipping (max_norm=1.0)
- **Retraining**: Manual via `POST /train/humidity`

### Baseline Models

| Model | File | Purpose |
|-------|------|---------|
| Persistence | `baselines/naive.py` | Forecast = last observed value |
| Seasonal naive | `baselines/naive.py` | Forecast = value 24h ago |
| Linear regression | `baselines/linear.py` | Same 14 features, sklearn LinearRegression |

## Configuration

All via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_ARTIFACT_PATH` | `artifacts/models/gru_latest.pt` | Trained model path |
| `HIDDEN_SIZE` | `64` | GRU hidden units |
| `NUM_LAYERS` | `2` | GRU layers |
| `LOOKBACK` | `24` | Sequence length (hours) |
| `LEARNING_RATE` | `0.001` | Adam learning rate |
| `MAX_EPOCHS` | `100` | Max training epochs |
| `EARLY_STOPPING_PATIENCE` | `10` | Epochs without improvement before stop |
| `DROPOUT` | `0.2` | Dropout rate (training + MC inference) |
| `MC_DROPOUT_SAMPLES` | `50` | Forward passes for uncertainty estimation |

## Evaluation & Drift

- **Evaluation**: `POST /evaluate/run` compares forecasts against actual sensor readings, computes MAE/RMSE/MAPE, writes to `forecast_evaluations` and `drift_metrics`
- **Prediction drift**: Tracks if recent MAE exceeds 1.5× baseline MAE
- **Coverage drift**: Monitors if empirical confidence interval falls >10% below expected 95%

## Project Structure

```
ai-forecast/
├── src/
│   ├── api/
│   │   ├── main.py              # FastAPI app + router registration
│   │   ├── security.py           # Bearer token auth
│   │   └── routers/
│   │       ├── forecast.py       # POST /forecast/humidity
│   │       ├── train.py          # POST /train/humidity, /hyperparameter-search
│   │       ├── model_registry.py # GET /models/latest
│   │       ├── evaluation.py     # Evaluation cycle endpoints
│   │       ├── drift.py          # Drift check endpoints
│   │       └── disease.py        # Disease detection placeholder
│   ├── config/
│   │   └── settings.py           # Env-based configuration
│   ├── data/
│   │   ├── connectors/
│   │   │   ├── mysql_source.py   # Sensor history ETL
│   │   │   └── timescale_store.py# Forecast + eval + drift persistence
│   │   └── pipelines/
│   │       ├── build_features.py # Preprocessing contract (v1)
│   │       ├── make_train_dataset.py
│   │       └── make_infer_dataset.py
│   ├── features/
│   │   ├── lag_features.py       # Lags + rolling stats
│   │   ├── time_features.py      # Hour, day_of_week, weekend
│   │   ├── weather_features.py   # Covariate columns
│   │   └── scaling.py            # Min-max scaler
│   ├── models/
│   │   ├── inference/predict.py  # MC Dropout inference
│   │   ├── training/
│   │   │   ├── train_rnn.py      # Training with validation + early stopping
│   │   │   └── tune_rnn.py       # Hyperparameter grid search
│   │   ├── baselines/
│   │   │   ├── naive.py          # Persistence + seasonal naive
│   │   │   └── linear.py         # Linear regression baseline
│   │   └── evaluation/
│   │       └── evaluator.py      # Forecast vs actual comparison
│   └── monitoring/
│       └── drift_monitor.py      # PSI, error drift, coverage drift
├── migrations/
│   └── 001_init_forecast_schema.sql
├── tests/
│   └── unit/
│       └── test_preprocess_pipeline.py
├── pyproject.toml
├── .env.example
├── README.md
└── ARCH.md
```
