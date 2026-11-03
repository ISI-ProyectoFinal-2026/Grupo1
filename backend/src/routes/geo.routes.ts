import { Router } from "express";
import * as geoController from "../controllers/geo.controller";
import { reverseGeocodeLimiter } from "../middlewares/rate-limit";

export const geoRouter = Router();

geoRouter.get("/nearby", geoController.nearby);
geoRouter.get("/map", geoController.map);
geoRouter.get("/reverse", reverseGeocodeLimiter, geoController.reverse);
