import api from "./api";
import type { Notification } from "../types/notification";

const notificationService = {
  async getAll(): Promise<Notification[]> {
    const { data } = await api.get("/notifications");
    return data;
  },

  async getUnreadCount(): Promise<number> {
    const { data } = await api.get("/notifications/unread-count");
    return data.count;
  },

  async markAsRead(id: number): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.put("/notifications/read-all");
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/notifications/${id}`);
  },
};

export default notificationService;
