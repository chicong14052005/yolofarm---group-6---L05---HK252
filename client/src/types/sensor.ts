export type SensorType = "temperature" | "humidity" | "soil_moisture" | "light";

export interface SensorData {
  id: number;
  sensor_type: SensorType;
  value: number;
  feed_key: string;
  recorded_at: string;
}

export interface SensorStats {
  sensor_type: SensorType;
  min_val: number;
  max_val: number;
  avg_val: number;
  count: number;
}

export const SENSOR_LABELS: Record<SensorType, string> = {
  temperature: "Nhiệt độ",
  humidity: "Độ ẩm",
  soil_moisture: "Độ ẩm đất",
  light: "Ánh sáng",
};

export const SENSOR_UNITS: Record<SensorType, string> = {
  temperature: "°C",
  humidity: "%",
  soil_moisture: "%",
  light: "lux",
};

export const SENSOR_ICONS: Record<SensorType, string> = {
  temperature: "🌡️",
  humidity: "💧",
  soil_moisture: "🌱",
  light: "☀️",
};
