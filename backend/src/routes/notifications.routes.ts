import { Router } from "express";
import * as notificationsController from "../controllers/notifications.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireInternalKey } from "../middlewares/internal-auth.middleware";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, notificationsController.list);
notificationsRouter.put("/:id/read", requireAuth, notificationsController.markRead);
notificationsRouter.delete("/:id", requireAuth, notificationsController.remove);

// Endpoint server-to-server: lo llama el Backend IA (matching_service.py)
// cuando persiste un match, no requiere sesión de usuario.
notificationsRouter.post("/internal/match", requireInternalKey, notificationsController.createMatchNotification);
