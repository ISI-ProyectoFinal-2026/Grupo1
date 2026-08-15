import { Request, Response } from "express";
import * as reportFlagsService from "../services/report-flags.service";
import { createReportFlagSchema, reportFlagReportIdParamSchema } from "../validators/report-flags.validator";

export async function create(req: Request, res: Response): Promise<void> {
  const { id } = reportFlagReportIdParamSchema.parse(req.params);
  const data = createReportFlagSchema.parse(req.body);
  const flag = await reportFlagsService.create(id, data);
  res.status(201).json(flag);
}
