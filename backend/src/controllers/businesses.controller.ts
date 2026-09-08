import { Request, Response } from "express";
import * as businessesService from "../services/businesses.service";
import {
  businessIdParamSchema,
  createBusinessSchema,
  listBusinessesQuerySchema,
  updateBusinessSchema,
} from "../validators/businesses.validator";

export async function list(req: Request, res: Response): Promise<void> {
  const filters = listBusinessesQuerySchema.parse(req.query);
  const businesses = await businessesService.listPublic(filters);
  res.status(200).json(businesses);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = businessIdParamSchema.parse(req.params);
  const business = await businessesService.getPublicById(id);
  await businessesService.recordView(id, req.userId);
  res.status(200).json(business);
}

export async function contact(req: Request, res: Response): Promise<void> {
  const { id } = businessIdParamSchema.parse(req.params);
  await businessesService.recordContact(id, req.userId!);
  res.status(204).send();
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = createBusinessSchema.parse(req.body);
  const business = await businessesService.create({ ...data, userId: req.userId! });
  res.status(201).json(business);
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const business = await businessesService.getByUserId(req.userId!);
  res.status(200).json(business);
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const data = updateBusinessSchema.parse(req.body);
  const business = await businessesService.updateByUserId(req.userId!, data);
  res.status(200).json(business);
}

export async function getStats(req: Request, res: Response): Promise<void> {
  const stats = await businessesService.getStats(req.userId!);
  res.status(200).json(stats);
}
