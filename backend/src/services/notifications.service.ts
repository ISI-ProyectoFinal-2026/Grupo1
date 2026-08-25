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

interface CreateForMatchInput {
  lostReportId: number;
  foundReportId: number;
  lostOwnerId: number;
  foundOwnerId: number;
  similarityScore: number;
}

/**
 * Crea una notificación de tipo "match_suggested" para cada dueño de los dos
 * reportes involucrados en un match, apuntando al *otro* reporte (el que
 * puede interesarle a ese usuario). Si ambos reportes pertenecen al mismo
 * usuario, se crea una única notificación (no tiene sentido notificarle dos
 * veces el mismo match a la misma persona).
 */
export async function createForMatch(data: CreateForMatchInput): Promise<Notification[]> {
  const similarityPercent = Math.round(data.similarityScore * 100);

  const recipients = [
    {
      userId: data.lostOwnerId,
      reportId: data.foundReportId,
      message: `Encontramos una publicación que podría coincidir con tu mascota perdida (${similarityPercent}% de similitud). Revisá los detalles.`,
    },
    {
      userId: data.foundOwnerId,
      reportId: data.lostReportId,
      message: `Encontramos una publicación que podría coincidir con la mascota que encontraste (${similarityPercent}% de similitud). Revisá los detalles.`,
    },
  ].filter((recipient, index, all) => all.findIndex((r) => r.userId === recipient.userId) === index);

  const notifications: Notification[] = [];
  for (const recipient of recipients) {
    const notification = await prisma.notification.create({
      data: {
        userId: recipient.userId,
        type: "match_suggested",
        title: "¡Posible coincidencia encontrada!",
        message: recipient.message,
        reportId: recipient.reportId,
      },
    });
    notifications.push(notification);
  }

  return notifications;
}

interface NotifyMatchInput {
  lostReportId: number;
  foundReportId: number;
  similarityScore: number;
}

/**
 * Resuelve los dueños de los dos reportes involucrados en un match (uno de
 * tipo "lost" y otro "found") y crea las notificaciones correspondientes.
 * Usado por el endpoint interno que dispara el Backend IA al persistir un
 * match (ver matching_service.py, find_and_store_matches).
 */
export async function notifyMatch(data: NotifyMatchInput): Promise<Notification[]> {
  const [lostReport, foundReport] = await Promise.all([
    prisma.report.findUnique({ where: { id: data.lostReportId } }),
    prisma.report.findUnique({ where: { id: data.foundReportId } }),
  ]);

  if (!lostReport) {
    throw new AppError(404, "El reporte de mascota perdida no existe");
  }
  if (!foundReport) {
    throw new AppError(404, "El reporte de mascota encontrada no existe");
  }

  return createForMatch({
    lostReportId: data.lostReportId,
    foundReportId: data.foundReportId,
    lostOwnerId: lostReport.userId,
    foundOwnerId: foundReport.userId,
    similarityScore: data.similarityScore,
  });
}
