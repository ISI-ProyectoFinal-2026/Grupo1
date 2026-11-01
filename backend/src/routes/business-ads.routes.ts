import { Router } from "express";
import * as businessAdsController from "../controllers/business-ads.controller";
import { requireAuth, requireVerifiedEmail } from "../middlewares/auth.middleware";

// anuncios del comercio propio, montado en /api/businesses/me/ads
export const businessAdsRouter = Router();

// publicar contenido exige el email verificado, como crear reportes
businessAdsRouter.get("/", requireAuth, businessAdsController.list);
businessAdsRouter.post("/", requireAuth, requireVerifiedEmail, businessAdsController.create);
businessAdsRouter.put("/:adId", requireAuth, requireVerifiedEmail, businessAdsController.update);
businessAdsRouter.patch("/:adId/status", requireAuth, requireVerifiedEmail, businessAdsController.setStatus);
businessAdsRouter.delete("/:adId", requireAuth, businessAdsController.remove);
businessAdsRouter.get("/:adId/stats", requireAuth, businessAdsController.getStats);
