import { Request, Response } from "express";
import * as service from "../services/notification-preferences.service";
import {
  locationBodySchema,
  locationConsentBodySchema,
  updatePreferencesBodySchema,
} from "../validators/notification-preferences.validator";

export async function get(req: Request, res: Response): Promise<void> {
  res.status(200).json(await service.get(req.userId!));
}

export async function update(req: Request, res: Response): Promise<void> {
  const data = updatePreferencesBodySchema.parse(req.body);
  res.status(200).json(await service.update(req.userId!, data));
}

export async function setLocationConsent(req: Request, res: Response): Promise<void> {
  const { status } = locationConsentBodySchema.parse(req.body);
  res.status(200).json(await service.setLocationConsent(req.userId!, status));
}

export async function setLocation(req: Request, res: Response): Promise<void> {
  const data = locationBodySchema.parse(req.body);
  res.status(200).json(await service.setLocation(req.userId!, data));
}
