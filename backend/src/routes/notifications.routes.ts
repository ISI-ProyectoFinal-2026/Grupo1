import { Router } from "express";
import * as notificationsController from "../controllers/notifications.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, notificationsController.list);
notificationsRouter.get("/unread-count", requireAuth, notificationsController.unreadCount);
notificationsRouter.put("/:id/read", requireAuth, notificationsController.markRead);
notificationsRouter.delete("/:id", requireAuth, notificationsController.remove);
