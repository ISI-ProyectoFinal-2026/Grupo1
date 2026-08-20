import { Router } from "express";
import * as reportsController from "../controllers/reports.controller";
import * as reportFlagsController from "../controllers/report-flags.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const reportsRouter = Router();

reportsRouter.get("/", reportsController.list);
reportsRouter.post("/", requireAuth, reportsController.create);
reportsRouter.get("/:id", reportsController.getById);
reportsRouter.get("/:id/matches", reportsController.getMatches);
reportsRouter.put("/:id", requireAuth, reportsController.update);
reportsRouter.delete("/:id", requireAuth, reportsController.remove);
reportsRouter.post("/:id/close", requireAuth, reportsController.close);
reportsRouter.post("/:id/flags", requireAuth, reportFlagsController.create);
