import { Router } from "express";
import * as geoController from "../controllers/geo.controller";

export const geoRouter = Router();

geoRouter.get("/nearby", geoController.nearby);
geoRouter.get("/map", geoController.map);
