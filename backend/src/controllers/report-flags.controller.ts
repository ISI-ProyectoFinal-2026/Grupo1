import { Request, Response } from "express";
import * as reportFlagsService from "../services/report-flags.service";
import {
  createReportFlagSchema,
  listReportFlagsQuerySchema,
  moderationActionSchema,
  moderationReportIdParamSchema,
  reportFlagReportIdParamSchema,
} from "../validators/report-flags.validator";

export async function create(req: Request, res: Response): Promise<void> {
  const { id } = reportFlagReportIdParamSchema.parse(req.params);
  const data = createReportFlagSchema.parse(req.body);
  const flag = await reportFlagsService.create(id, { ...data, userId: req.userId! });
  res.status(201).json(flag);
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = listReportFlagsQuerySchema.parse(req.query);
  const flags = await reportFlagsService.list(query);
  res.status(200).json(flags);
}

export async function moderate(req: Request, res: Response): Promise<void> {
  const { reportId } = moderationReportIdParamSchema.parse(req.params);
  const { action } = moderationActionSchema.parse(req.body);
  const result = await reportFlagsService.moderate(reportId, action);
  res.status(200).json(result);
}
