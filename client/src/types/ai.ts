export interface PredictionResult {
  sensor_type: string;
  predictions: Array<{ timestamp: string; value: number }>;
  confidence: number;
}

export interface HumidityForecastPoint {
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

export interface DataSummary {
  total_records: number;
  median_interval_s: number;
  gaps_above_2x: number;
  resampled_interval_min: number;
  coverage_pct: number;
  n_sequences: number;
}

export interface HumidityForecastResult {
  sensor_type: string;
  horizon_hours: number;
  interval_minutes: number;
  generated_at: string;
  model_version: string;
  predictions: HumidityForecastPoint[];
  historical_predictions?: HistoricalPredictionPoint[];
  data_summary?: DataSummary;
  fallback?: boolean;
  error?: string;
  alert_status?: {
    triggered: boolean;
    reason?: string;
    threshold?: number;
    minConfidence?: number;
    usersNotified?: number;
    firstBreachAt?: string;
  };
}

export interface DiseaseDetectionResult {
  disease_name: string;
  confidence: number;
  description: string;
  crop_type: string;
  pest_common_name: string;
  treatments: Treatment[];
  threat_level: "low" | "medium" | "high";
  estimated_count?: number;
}

export interface Treatment {
  name: string;
  type: string;
  description: string;
  efficacy: number;
  tags: string[];
}
