import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as reportsController from "../controllers/reports.controller";
import * as reportFlagsController from "../controllers/report-flags.controller";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware";

export const reportsRouter = Router();

const flyerLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Límite de generación de flyers alcanzado, esperá un minuto" } },
  skip: () => process.env.NODE_ENV === "test",
});

reportsRouter.get("/", optionalAuth, reportsController.list);
reportsRouter.post("/", requireAuth, reportsController.create);
reportsRouter.get("/:id", optionalAuth, reportsController.getById);
// Las coincidencias sugeridas por la IA se derivan del reporte pero exigen
// sesión: el reporte en sí es público (material compartible, flyer), pero el
// grafo de matches no debe ser scrapeable por un anónimo. No se chequea
// propiedad a propósito: la UI muestra las coincidencias a cualquier usuario
// autenticado que mire el reporte (un buen samaritano que ve un "encontrado"
// puede ver que coincide con un "perdido"), no solo al dueño (issue #175).
reportsRouter.get("/:id/matches", requireAuth, reportsController.getMatches);
// Decidir sobre una coincidencia sí exige ser dueño del reporte :id.
reportsRouter.post("/:id/matches/:matchId/confirm", requireAuth, reportsController.confirmMatch);
reportsRouter.post("/:id/matches/:matchId/reject", requireAuth, reportsController.rejectMatch);
// Pública a propósito (issue #170): el flyer es material de difusión pensado
// para compartir fuera de la app. El limiter acota el abuso anónimo; el costo
// real (componer + subir a R2) solo se paga cuando cambia el contenido del
// reporte, ver flyer.service. optionalAuth es para respetar la visibilidad del
// detalle (#180): el dueño ve el flyer de su reporte pending/rejected, el
// resto recibe 404. El limiter va primero para que un token inválido también
// consuma cupo.
reportsRouter.get("/:id/flyer", flyerLimiter, optionalAuth, reportsController.getFlyer);
reportsRouter.put("/:id", requireAuth, reportsController.update);
reportsRouter.put("/:id/flyer/custom", requireAuth, reportsController.setCustomFlyer);
reportsRouter.delete("/:id", requireAuth, reportsController.remove);
reportsRouter.post("/:id/close", requireAuth, reportsController.close);
reportsRouter.post("/:id/flags", requireAuth, reportFlagsController.create);
