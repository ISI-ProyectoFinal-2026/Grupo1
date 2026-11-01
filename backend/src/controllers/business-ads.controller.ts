import { Request, Response } from "express";
import * as adsService from "../services/ads.service";
import { adIdParamSchema, createAdSchema, setAdStatusSchema, updateAdSchema } from "../validators/ads.validator";

export async function list(req: Request, res: Response): Promise<void> {
  res.status(200).json(await adsService.listOwn(req.userId!));
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = createAdSchema.parse(req.body);
  res.status(201).json(await adsService.create(req.userId!, data));
}

export async function update(req: Request, res: Response): Promise<void> {
  const { adId } = adIdParamSchema.parse(req.params);
  const data = updateAdSchema.parse(req.body);
  res.status(200).json(await adsService.update(req.userId!, adId, data));
}

export async function setStatus(req: Request, res: Response): Promise<void> {
  const { adId } = adIdParamSchema.parse(req.params);
  const { status } = setAdStatusSchema.parse(req.body);
  res.status(200).json(await adsService.setStatus(req.userId!, adId, status));
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { adId } = adIdParamSchema.parse(req.params);
  await adsService.remove(req.userId!, adId);
  res.status(204).send();
}
