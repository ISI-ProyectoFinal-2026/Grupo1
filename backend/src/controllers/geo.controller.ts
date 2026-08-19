import { Request, Response } from "express";
import * as geoService from "../services/geo.service";
import { geoMapQuerySchema, geoNearbyQuerySchema } from "../validators/geo.validator";

export async function nearby(req: Request, res: Response): Promise<void> {
  const { lat, lng, radius } = geoNearbyQuerySchema.parse(req.query);
  const reports = await geoService.nearby(lat, lng, radius);
  res.status(200).json(reports);
}

export async function map(req: Request, res: Response): Promise<void> {
  const { bounds } = geoMapQuerySchema.parse(req.query);
  const reports = await geoService.withinBounds(bounds);
  res.status(200).json(reports);
}
