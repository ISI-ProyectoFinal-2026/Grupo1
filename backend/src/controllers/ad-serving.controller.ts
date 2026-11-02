import { Request, Response } from "express";
import * as adEventsService from "../services/ad-events.service";
import * as adServingService from "../services/ad-serving.service";
import { adEventSchema, adIdParamSchema, adQuerySchema } from "../validators/ads.validator";
import { reportIdParamSchema } from "../validators/reports.validator";

// 200 con null cuando no hay ningún anuncio activo
export async function getAd(req: Request, res: Response): Promise<void> {
  const { placement, reportId } = adQuerySchema.parse(req.query);
  res.status(200).json(await adServingService.getAdFor(placement, reportId, req.userId));
}

export async function recordEvent(req: Request, res: Response): Promise<void> {
  const { adId } = adIdParamSchema.parse(req.params);
  const { type, placement } = adEventSchema.parse(req.body);
  await adEventsService.record(adId, type, placement, req.userId);
  res.status(204).send();
}

export async function getNearbyBusinesses(req: Request, res: Response): Promise<void> {
  const { id } = reportIdParamSchema.parse(req.params);
  res.status(200).json(await adServingService.getNearbyBusinesses(id, req.userId));
}
