import { Notification } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";

export async function listByUser(userId: number): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

async function findOwnedOrThrow(notificationId: number, userId: number): Promise<Notification> {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) {
    throw new AppError(404, "Notificación no encontrada");
  }
  if (notification.userId !== userId) {
    throw new AppError(403, "No tenés permiso para modificar esta notificación");
  }
  return notification;
}

export async function markAsRead(notificationId: number, userId: number): Promise<Notification> {
  await findOwnedOrThrow(notificationId, userId);
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function remove(notificationId: number, userId: number): Promise<void> {
  await findOwnedOrThrow(notificationId, userId);
  await prisma.notification.delete({ where: { id: notificationId } });
}
