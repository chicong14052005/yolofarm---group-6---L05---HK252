export interface PredictionResult {
  sensor_type: string;
  predictions: Array<{ timestamp: string; value: number }>;
  confidence: number;
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
