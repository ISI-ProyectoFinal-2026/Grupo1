import { Router } from "express";
import * as accountReportsController from "../controllers/account-reports.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

// denuncia de cuentas con gravedad (#267)
export const accountReportsRouter = Router();

accountReportsRouter.post("/", requireAuth, accountReportsController.create);
accountReportsRouter.get("/", requireAuth, requireRole("moderador", "admin"), accountReportsController.list);
