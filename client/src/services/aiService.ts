import api from "./api";
import type {
  PredictionResult,
  DiseaseDetectionResult,
  HumidityForecastResult,
} from "../types/ai";

const aiService = {
  async predict(sensorType: string, hours = 24): Promise<PredictionResult> {
    const { data } = await api.post("/ai/predict", {
      sensor_type: sensorType,
      hours,
    });
    return data;
  },

  async detectDisease(imageFile: File): Promise<DiseaseDetectionResult> {
    const formData = new FormData();
    formData.append("image", imageFile);
    const { data } = await api.post("/ai/detect-disease", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000, // 60s — ML inference có thể mất thời gian
    });
    return data;
  },

  async getCachedForecast(): Promise<HumidityForecastResult> {
    const { data } = await api.get("/ai/forecast/humidity");
    return data;
  },

  async forecastHumidity(
    historyHours = 72,
    horizonHours = 24,
    confidenceThreshold = 0.7,
  ): Promise<HumidityForecastResult> {
    const { data } = await api.post("/ai/forecast/humidity", {
      history_hours: historyHours,
      horizon_hours: horizonHours,
      confidence_threshold: confidenceThreshold,
    });
    return data;
  },
};

export default aiService;
