export type DeviceType = "pump1" | "pump2" | "led_rgb";
export type DeviceStatus = "on" | "off";

export interface Device {
  id: number;
  device_name: string;
  device_type: DeviceType;
  feed_key: string;
  status: DeviceStatus;
  last_updated: string;
}

export interface DeviceCommand {
  device_type: DeviceType;
  action: "on" | "off";
}

export const DEVICE_LABELS: Record<DeviceType, string> = {
  pump1: "Máy bơm 1",
  pump2: "Máy bơm 2",
  led_rgb: "Đèn LED RGB",
};
