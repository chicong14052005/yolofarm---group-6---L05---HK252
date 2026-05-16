CREATE SCHEMA IF NOT EXISTS forecast;

CREATE TABLE IF NOT EXISTS forecast.model_registry (
  id BIGSERIAL PRIMARY KEY,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL UNIQUE,
  framework TEXT NOT NULL DEFAULT 'pytorch',
  training_started_at TIMESTAMPTZ,
  training_finished_at TIMESTAMPTZ,
  metrics JSONB,
  params JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forecast.training_runs (
  id BIGSERIAL PRIMARY KEY,
  model_version TEXT NOT NULL,
  data_start TIMESTAMPTZ,
  data_end TIMESTAMPTZ,
  horizon_hours INT NOT NULL,
  metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forecast.humidity_forecasts (
  id BIGSERIAL PRIMARY KEY,
  model_version TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  forecast_at TIMESTAMPTZ NOT NULL,
  horizon_step INT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  lower_bound DOUBLE PRECISION,
  upper_bound DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_humidity_forecasts_generated_at
  ON forecast.humidity_forecasts (generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_humidity_forecasts_forecast_at
  ON forecast.humidity_forecasts (forecast_at DESC);

CREATE TABLE IF NOT EXISTS forecast.forecast_evaluations (
  id BIGSERIAL PRIMARY KEY,
  model_version TEXT NOT NULL,
  forecast_at TIMESTAMPTZ NOT NULL,
  actual_value DOUBLE PRECISION,
  predicted_value DOUBLE PRECISION,
  absolute_error DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forecast.drift_metrics (
  id BIGSERIAL PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value DOUBLE PRECISION NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB
);
