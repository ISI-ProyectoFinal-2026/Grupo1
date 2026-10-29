import { Router } from "express";
import * as controller from "../controllers/notification-preferences.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const notificationPreferencesRouter = Router();

notificationPreferencesRouter.get("/", requireAuth, controller.get);
notificationPreferencesRouter.put("/", requireAuth, controller.update);
notificationPreferencesRouter.put("/location-consent", requireAuth, controller.setLocationConsent);
notificationPreferencesRouter.put("/location", requireAuth, controller.setLocation);
