import { Request, Response } from "express";
import * as adServingService from "../services/ad-serving.service";
import { adQuerySchema } from "../validators/ads.validator";
import { reportIdParamSchema } from "../validators/reports.validator";

// 200 con null cuando no hay ningún anuncio activo
export async function getAd(req: Request, res: Response): Promise<void> {
  const { placement, reportId } = adQuerySchema.parse(req.query);
  res.status(200).json(await adServingService.getAdFor(placement, reportId, req.userId));
}

export async function getNearbyBusinesses(req: Request, res: Response): Promise<void> {
  const { id } = reportIdParamSchema.parse(req.params);
  res.status(200).json(await adServingService.getNearbyBusinesses(id, req.userId));
}
