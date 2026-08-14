import { Router } from "express";
import * as reportsController from "../controllers/reports.controller";

export const reportsRouter = Router();

reportsRouter.get("/", reportsController.list);
reportsRouter.post("/", reportsController.create);
reportsRouter.get("/:id", reportsController.getById);
reportsRouter.get("/:id/matches", reportsController.getMatches);
reportsRouter.put("/:id", reportsController.update);
reportsRouter.delete("/:id", reportsController.remove);
