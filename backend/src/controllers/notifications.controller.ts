import { Request, Response } from "express";
import * as notificationsService from "../services/notifications.service";
import { matchNotificationBodySchema, notificationIdParamSchema } from "../validators/notifications.validator";

export async function list(req: Request, res: Response): Promise<void> {
  const notifications = await notificationsService.listByUser(req.userId!);
  res.status(200).json(notifications);
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

export async function createMatchNotification(req: Request, res: Response): Promise<void> {
  const data = matchNotificationBodySchema.parse(req.body);
  const notifications = await notificationsService.notifyMatch(data);
  res.status(201).json(notifications);
}
