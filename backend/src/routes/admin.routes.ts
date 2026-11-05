import { Router } from "express";
import * as adminSanctionsController from "../controllers/admin-sanctions.controller";
import * as adminUsersController from "../controllers/admin-users.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

// Todo /api/admin es solo para admin: el guard va a nivel router.
export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("admin"));

adminRouter.get("/users", adminUsersController.listUsers);
adminRouter.get("/role-audit", adminUsersController.listRoleAudit);
adminRouter.patch("/users/:id/role", adminUsersController.changeRole);
adminRouter.get("/account-sanctions/pending", adminSanctionsController.listPending);
