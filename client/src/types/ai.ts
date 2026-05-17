export interface PredictionResult {
  sensor_type: string;
  predictions: Array<{ timestamp: string; value: number }>;
  confidence: number;
}

/* ── Disease Detection (FastAPI response) ── */

export interface DiseaseDetectionData {
  disease_id: number;
  disease_name: string;
  treatment: string;
  confidence: number; // Giá trị 0–100 (đã nhân 100)
}

export interface DiseaseDetectionResult {
  success: boolean;
  data: DiseaseDetectionData;
}
