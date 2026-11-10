import { Router } from "express";
import * as adminSanctionsController from "../controllers/admin-sanctions.controller";
import * as adminUsersController from "../controllers/admin-users.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

export const adminRouter = Router();

// cola de sanciones: moderador también (reincidencias); el service filtra por rol
const sanctionsGuard = [requireAuth, requireRole("moderador", "admin")];
adminRouter.get("/account-sanctions/pending", ...sanctionsGuard, adminSanctionsController.listPending);
adminRouter.post("/account-sanctions/:id/confirm", ...sanctionsGuard, adminSanctionsController.confirm);
adminRouter.post("/account-sanctions/:id/revert", ...sanctionsGuard, adminSanctionsController.revert);

// el resto de /api/admin es solo para admin: el guard va a nivel router
adminRouter.use(requireAuth, requireRole("admin"));

adminRouter.get("/users", adminUsersController.listUsers);
adminRouter.get("/role-audit", adminUsersController.listRoleAudit);
adminRouter.patch("/users/:id/role", adminUsersController.changeRole);
