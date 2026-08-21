import { Router } from "express";
import * as businessesController from "../controllers/businesses.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const businessesRouter = Router();

businessesRouter.post("/", requireAuth, businessesController.create);
businessesRouter.get("/me", requireAuth, businessesController.getMe);
businessesRouter.put("/me", requireAuth, businessesController.updateMe);
businessesRouter.get("/me/stats", requireAuth, businessesController.getStats);
