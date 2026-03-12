import api from "./api";
import type { Device, DeviceCommand } from "../types/device";

const deviceService = {
  async getAll(): Promise<Device[]> {
    const { data } = await api.get("/devices");
    return data;
  },

  async control(
    command: DeviceCommand,
  ): Promise<{ message: string; device: Device }> {
    const { data } = await api.post("/devices/control", command);
    return data;
  },

  async getStatus(type: string): Promise<Device> {
    const { data } = await api.get(`/devices/status/${type}`);
    return data;
  },
};

export default deviceService;
