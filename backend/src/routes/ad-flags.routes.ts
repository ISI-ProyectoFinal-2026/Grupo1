import { Router } from "express";
import * as adFlagsController from "../controllers/ad-flags.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

// cola de moderación de anuncios, como /api/report-flags
export const adFlagsRouter = Router();

adFlagsRouter.get("/", requireAuth, requireRole("moderador", "admin"), adFlagsController.list);
adFlagsRouter.patch("/:id", requireAuth, requireRole("moderador", "admin"), adFlagsController.resolve);
