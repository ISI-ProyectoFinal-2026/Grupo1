import { Router } from "express";
import * as reportsController from "../controllers/reports.controller";
import * as reportFlagsController from "../controllers/report-flags.controller";

export const reportsRouter = Router();

reportsRouter.get("/", reportsController.list);
reportsRouter.post("/", reportsController.create);
reportsRouter.get("/:id", reportsController.getById);
reportsRouter.put("/:id", reportsController.update);
reportsRouter.delete("/:id", reportsController.remove);
reportsRouter.post("/:id/flags", reportFlagsController.create);
