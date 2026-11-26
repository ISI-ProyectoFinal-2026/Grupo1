import { Request, Response } from "express";
import * as notificationsService from "../services/notifications.service";
import { listNotificationsQuerySchema, notificationIdParamSchema } from "../validators/notifications.validator";

export async function list(req: Request, res: Response): Promise<void> {
  const query = listNotificationsQuerySchema.parse(req.query);
  res.status(200).json(await notificationsService.listByUser(req.userId!, query));
}

export async function unreadCount(req: Request, res: Response): Promise<void> {
  res.status(200).json({ count: await notificationsService.countUnread(req.userId!) });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const { id } = notificationIdParamSchema.parse(req.params);
  const notification = await notificationsService.markAsRead(id, req.userId!);
  res.status(200).json(notification);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = notificationIdParamSchema.parse(req.params);
  await notificationsService.remove(id, req.userId!);
  res.status(204).send();
}
