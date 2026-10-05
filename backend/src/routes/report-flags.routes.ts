import { Router } from "express";
import * as reportFlagsController from "../controllers/report-flags.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

// Cola de moderación (issue #183): resource nuevo, separado del anidado
// POST /api/reports/:id/flags (creación de un flag por un usuario cualquiera).
// Acá el moderador lista y resuelve los flags reportados.
export const reportFlagsRouter = Router();

reportFlagsRouter.get("/", requireAuth, requireRole("moderador", "admin"), reportFlagsController.list);
reportFlagsRouter.patch("/:id", requireAuth, requireRole("moderador", "admin"), reportFlagsController.resolve);
