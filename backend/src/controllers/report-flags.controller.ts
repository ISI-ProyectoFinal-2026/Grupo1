import { Request, Response } from "express";
import * as reportFlagsService from "../services/report-flags.service";
import {
  createReportFlagSchema,
  listReportFlagsQuerySchema,
  reportFlagIdParamSchema,
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

export async function resolve(req: Request, res: Response): Promise<void> {
  const { id } = reportFlagIdParamSchema.parse(req.params);
  const flag = await reportFlagsService.resolve(id);
  res.status(200).json(flag);
}
