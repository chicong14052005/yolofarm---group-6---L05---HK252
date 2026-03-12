import api from "./api";
import type { SensorData, SensorType, SensorStats } from "../types/sensor";

const sensorService = {
  async getLatest(): Promise<SensorData[]> {
    const { data } = await api.get("/sensors/latest");
    return data;
  },

  async getHistory(type: SensorType, hours = 24): Promise<SensorData[]> {
    const { data } = await api.get(`/sensors/history/${type}?hours=${hours}`);
    return data;
  },

  async getStats(type: SensorType, hours = 24): Promise<SensorStats> {
    const { data } = await api.get(`/sensors/stats/${type}?hours=${hours}`);
    return data;
  },
};

export default sensorService;
