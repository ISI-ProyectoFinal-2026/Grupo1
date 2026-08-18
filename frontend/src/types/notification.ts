// Nota: el backend todavía no expone endpoints REST para notificaciones
// (el modelo Notification existe en Prisma pero sin ruta/controller).
// Este tipo refleja el schema para que la UI pueda tiparse desde ya.

export type NotificationType =
  | "match_suggested"
  | "message"
  | "report_status_change";

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType | null;
  title: string | null;
  message: string | null;
  reportId: number | null;
  isRead: boolean;
  createdAt: string;
}
