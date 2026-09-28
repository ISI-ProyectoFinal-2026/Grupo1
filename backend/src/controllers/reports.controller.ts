import { Request, Response } from "express";
import * as reportsService from "../services/reports.service";
import * as matchingService from "../services/matching.service";
import * as flyerService from "../services/flyer.service";
import {
  createReportSchema,
  listReportsQuerySchema,
  reportIdParamSchema,
  reportMatchParamsSchema,
  setCustomFlyerSchema,
  updateReportSchema,
} from "../validators/reports.validator";

export async function list(req: Request, res: Response): Promise<void> {
  const filters = listReportsQuerySchema.parse(req.query);
  const reports = await reportsService.list(filters, req.userId);
  res.status(200).json(reports);
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = createReportSchema.parse(req.body);
  const report = await reportsService.create({ ...data, userId: req.userId! });
  res.status(201).json(report);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = reportIdParamSchema.parse(req.params);
  const report = await reportsService.getVisibleById(id, req.userId);
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

export async function confirmMatch(req: Request, res: Response): Promise<void> {
  const { id, matchId } = reportMatchParamsSchema.parse(req.params);
  const decision = await matchingService.confirmMatch(id, matchId, req.userId!);
  res.status(200).json(decision);
}

export async function rejectMatch(req: Request, res: Response): Promise<void> {
  const { id, matchId } = reportMatchParamsSchema.parse(req.params);
  const decision = await matchingService.rejectMatch(id, matchId, req.userId!);
  res.status(200).json(decision);
}

export async function getFlyer(req: Request, res: Response): Promise<void> {
  const { id } = reportIdParamSchema.parse(req.params);
  // Mismo criterio que el detalle (#180): un reporte pending/rejected solo lo
  // ve su dueño, así que para cualquier otro el flyer también es 404.
  const report = await reportsService.getVisibleById(id, req.userId);
  if (report.customFlyerUrl) {
    res.status(200).json({ flyerUrl: report.customFlyerUrl });
    return;
  }
  const flyerUrl = await flyerService.getOrCreateFlyerUrl(report);
  res.status(200).json({ flyerUrl });
}

export async function setCustomFlyer(req: Request, res: Response): Promise<void> {
  const { id } = reportIdParamSchema.parse(req.params);
  const { flyerUrl } = setCustomFlyerSchema.parse(req.body);
  const report = await reportsService.setCustomFlyer(id, req.userId!, flyerUrl);
  res.status(200).json(report);
}
