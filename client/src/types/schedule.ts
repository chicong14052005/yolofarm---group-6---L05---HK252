export interface Schedule {
  id: number;
  user_id: number;
  schedule_name: string;
  start_time: string;
  duration_minutes: number;
  repeat_days: string;
  is_active: boolean;
  pump_device: "pump1" | "pump2";
  created_at: string;
  updated_at: string;
}

export interface ScheduleFormData {
  schedule_name: string;
  start_time: string;
  duration_minutes: number;
  repeat_days: string;
  pump_device: "pump1" | "pump2";
}
