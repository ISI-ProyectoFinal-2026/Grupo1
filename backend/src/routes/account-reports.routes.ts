import { Router } from "express";
import * as accountReportsController from "../controllers/account-reports.controller";
import { requireAuth, requireRole, requireVerifiedEmail } from "../middlewares/auth.middleware";
import { accountReportCreateLimiter } from "../middlewares/rate-limit";

// denuncia de cuentas con gravedad (#267)
export const accountReportsRouter = Router();

accountReportsRouter.post(
  "/",
  requireAuth,
  requireVerifiedEmail,
  accountReportCreateLimiter,
  accountReportsController.create
);
accountReportsRouter.get("/", requireAuth, requireRole("moderador", "admin"), accountReportsController.list);
