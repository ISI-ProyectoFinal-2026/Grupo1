import { Router } from "express";
import * as adServingController from "../controllers/ad-serving.controller";
import { optionalAuth } from "../middlewares/auth.middleware";

export const adsRouter = Router();

// público; con sesión segmenta por la ubicación consentida
adsRouter.get("/", optionalAuth, adServingController.getAd);
