import { Request, Response } from "express";
import * as reportsService from "../services/reports.service";
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
  const report = await reportsService.create(data);
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
  const report = await reportsService.update(id, data);
  res.status(200).json(report);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = reportIdParamSchema.parse(req.params);
  await reportsService.remove(id);
  res.status(204).send();
}
