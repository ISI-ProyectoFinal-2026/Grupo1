import { Request, Response } from "express";
import * as geoService from "../services/geo.service";
import { reverseGeocoder } from "../services/reverse-geocode.service";
import { geoMapQuerySchema, geoNearbyQuerySchema, geoReverseQuerySchema } from "../validators/geo.validator";

export async function nearby(req: Request, res: Response): Promise<void> {
  const { lat, lng, radius, ...filters } = geoNearbyQuerySchema.parse(req.query);
  const reports = await geoService.nearby(lat, lng, radius, filters);
  res.status(200).json(reports);
}

export async function reverse(req: Request, res: Response): Promise<void> {
  const { lat, lng } = geoReverseQuerySchema.parse(req.query);
  const address = await reverseGeocoder.reverse(lat, lng);
  res.status(200).json({ address });
}

export async function map(req: Request, res: Response): Promise<void> {
  const { bounds, ...filters } = geoMapQuerySchema.parse(req.query);
  const reports = await geoService.withinBounds(bounds, filters);
  res.status(200).json(reports);
}
