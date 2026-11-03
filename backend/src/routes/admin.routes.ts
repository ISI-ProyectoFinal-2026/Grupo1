import { Router } from "express";
import * as adminUsersController from "../controllers/admin-users.controller";
import { requireAuth, requireRole } from "../middlewares/auth.middleware";

// Todo /api/admin es solo para admin: el guard va a nivel router.
export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("admin"));

adminRouter.patch("/users/:id/role", adminUsersController.changeRole);
