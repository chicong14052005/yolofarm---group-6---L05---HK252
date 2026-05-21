export interface PredictionResult {
  sensor_type: string;
  predictions: Array<{ timestamp: string; value: number }>;
  confidence: number;
}

export interface ForecastPoint {
  timestamp: string;
  value: number;
  lower: number;
  upper: number;
  confidence: number;
}

export interface HistoricalPredictionPoint {
  timestamp: string;
  actual: number;
  predicted: number;
}

export interface ForecastDataSummary {
  total_records: number;
  median_interval_s: number;
  gaps_above_2x: number;
  resampled_interval_min: number;
  coverage_pct: number;
  n_sequences: number;
}

export interface ForecastAlertStatus {
  triggered: boolean;
  reason?: string;
  threshold?: number;
  minConfidence?: number;
  usersNotified?: number;
  firstBreachAt?: string;
}

export interface HumidityForecastResult {
  sensor_type: string;
  horizon_hours: number;
  interval_minutes: number;
  model_version: string;
  generated_at: string | null;
  data_summary?: ForecastDataSummary | null;
  historical_predictions: HistoricalPredictionPoint[];
  predictions: ForecastPoint[];
  fallback?: boolean;
  error?: string | null;
  alert_status?: ForecastAlertStatus;
  cache_status?: 'empty' | 'cached' | 'refreshing' | 'stale' | 'fallback';
  refresh_in_progress?: boolean;
  cache_fallback?: boolean;
  cache_age_ms?: number;
}

export interface HumidityWeeklySummaryRow {
  date: string;
  actual_avg: number | null;
  predicted_avg: number | null;
  variance: number | null;
  status: 'low' | 'optimal' | 'high' | 'missing';
  missing_reason?: 'no_forecast_cache' | 'no_forecast_history' | 'no_historical_prediction' | 'no_actual_data' | 'no_historical_prediction_for_day' | null;
  prediction_count?: number;
}

export interface HumidityWeeklySummaryResult {
  sensor_type: 'humidity';
  days: number;
  prediction_source: 'historical_backtest';
  historical_prediction_count: number;
  cache_generated_at: string | null;
  history_generated_at?: string | null;
  rows: HumidityWeeklySummaryRow[];
}

export interface DiseaseDetectionData {
  disease_id: number;
  disease_name: string;
  treatment: string;
  confidence: number;
  description?: string;
}

export interface DiseaseDetectionResult {
  success: boolean;
  data: DiseaseDetectionData;
}
