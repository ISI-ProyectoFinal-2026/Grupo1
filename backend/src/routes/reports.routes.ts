import { Router } from "express";
import * as reportsController from "../controllers/reports.controller";
import * as reportFlagsController from "../controllers/report-flags.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const reportsRouter = Router();

reportsRouter.get("/", reportsController.list);
reportsRouter.post("/", requireAuth, reportsController.create);
reportsRouter.get("/:id", reportsController.getById);
// Las coincidencias sugeridas por la IA se derivan del reporte pero exigen
// sesión: el reporte en sí es público (material compartible, flyer), pero el
// grafo de matches no debe ser scrapeable por un anónimo. No se chequea
// propiedad a propósito: la UI muestra las coincidencias a cualquier usuario
// autenticado que mire el reporte (un buen samaritano que ve un "encontrado"
// puede ver que coincide con un "perdido"), no solo al dueño (issue #175).
reportsRouter.get("/:id/matches", requireAuth, reportsController.getMatches);
reportsRouter.get("/:id/flyer", reportsController.getFlyer);
reportsRouter.put("/:id", requireAuth, reportsController.update);
reportsRouter.put("/:id/flyer/custom", requireAuth, reportsController.setCustomFlyer);
reportsRouter.delete("/:id", requireAuth, reportsController.remove);
reportsRouter.post("/:id/close", requireAuth, reportsController.close);
reportsRouter.post("/:id/flags", requireAuth, reportFlagsController.create);
