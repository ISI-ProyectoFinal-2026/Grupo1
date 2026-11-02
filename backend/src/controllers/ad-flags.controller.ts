import { Request, Response } from "express";
import * as adFlagsService from "../services/ad-flags.service";
import {
  adFlagIdParamSchema,
  createAdFlagSchema,
  listAdFlagsQuerySchema,
  resolveAdFlagSchema,
} from "../validators/ad-flags.validator";
import { adIdParamSchema } from "../validators/ads.validator";

export async function create(req: Request, res: Response): Promise<void> {
  const { adId } = adIdParamSchema.parse(req.params);
  const data = createAdFlagSchema.parse(req.body);
  res.status(201).json(await adFlagsService.create(adId, { ...data, userId: req.userId! }));
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = listAdFlagsQuerySchema.parse(req.query);
  res.status(200).json(await adFlagsService.list(query));
}

export async function resolve(req: Request, res: Response): Promise<void> {
  const { id } = adFlagIdParamSchema.parse(req.params);
  const { action } = resolveAdFlagSchema.parse(req.body);
  res.status(200).json(await adFlagsService.resolve(id, action));
}
