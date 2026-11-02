import { Router } from "express";
import * as adServingController from "../controllers/ad-serving.controller";
import * as adFlagsController from "../controllers/ad-flags.controller";
import { optionalAuth, requireAuth } from "../middlewares/auth.middleware";
import { adEventsLimiter } from "../middlewares/rate-limit";

export const adsRouter = Router();

// público; con sesión segmenta por la ubicación consentida
adsRouter.get("/", optionalAuth, adServingController.getAd);
// impresiones y clics; la sesión solo sirve para descartar al dueño
adsRouter.post("/:adId/events", adEventsLimiter, optionalAuth, adServingController.recordEvent);
adsRouter.post("/:adId/flags", requireAuth, adFlagsController.create);
