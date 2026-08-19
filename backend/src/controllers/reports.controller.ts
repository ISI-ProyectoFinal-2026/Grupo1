import { Request, Response } from "express";
import * as reportsService from "../services/reports.service";
import * as matchingService from "../services/matching.service";
import {
  createReportSchema,
  listReportsQuerySchema,
  reportIdParamSchema,
  updateReportSchema,
} from "../validators/reports.validator";

export async function list(req: Request, res: Response): Promise<void> {
  const filters = listReportsQuerySchema.parse(req.query);
  const reports = await reportsService.list(filters);
  res.status(200).json(reports);
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = createReportSchema.parse(req.body);
  const report = await reportsService.create({ ...data, userId: req.userId! });
  res.status(201).json(report);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = reportIdParamSchema.parse(req.params);
  const report = await reportsService.getById(id);
  res.status(200).json(report);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = reportIdParamSchema.parse(req.params);
  const data = updateReportSchema.parse(req.body);
  const report = await reportsService.update(id, req.userId!, data);
  res.status(200).json(report);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = reportIdParamSchema.parse(req.params);
  await reportsService.remove(id, req.userId!);
  res.status(204).send();
}

export async function close(req: Request, res: Response): Promise<void> {
  const { id } = reportIdParamSchema.parse(req.params);
  const report = await reportsService.close(id, req.userId!);
  res.status(200).json(report);
}

export async function getMatches(req: Request, res: Response): Promise<void> {
  const { id } = reportIdParamSchema.parse(req.params);
  await reportsService.getById(id); // dispara 404 si no existe
  const matches = await matchingService.listMatches(id);
  res.status(200).json(matches);
}
