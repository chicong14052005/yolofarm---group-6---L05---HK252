export type NotificationType =
  | "warning"
  | "info"
  | "error"
  | "ai_alert"
  | "system";

export interface Notification {
  id: number;
  user_id: number | null;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  warning: "var(--warning)",
  info: "var(--info)",
  error: "var(--danger)",
  ai_alert: "var(--primary)",
  system: "var(--text-secondary)",
};
