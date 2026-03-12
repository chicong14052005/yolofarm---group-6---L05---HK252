import api from "./api";
import type { Schedule, ScheduleFormData } from "../types/schedule";

const scheduleService = {
  async getAll(): Promise<Schedule[]> {
    const { data } = await api.get("/schedules");
    return data;
  },

  async create(schedule: ScheduleFormData): Promise<Schedule> {
    const { data } = await api.post("/schedules", schedule);
    return data;
  },

  async update(
    id: number,
    schedule: Partial<ScheduleFormData>,
  ): Promise<Schedule> {
    const { data } = await api.put(`/schedules/${id}`, schedule);
    return data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/schedules/${id}`);
  },
};

export default scheduleService;
