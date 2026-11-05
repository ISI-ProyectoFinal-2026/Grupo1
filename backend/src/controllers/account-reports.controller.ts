import { Request, Response } from "express";
import * as accountReportsService from "../services/account-reports.service";
import { createAccountReportSchema } from "../validators/account-reports.validator";

export async function create(req: Request, res: Response): Promise<void> {
  const data = createAccountReportSchema.parse(req.body);
  const report = await accountReportsService.create(req.userId!, data);
  res.status(201).json(report);
}

export async function list(_req: Request, res: Response): Promise<void> {
  const accounts = await accountReportsService.list();
  res.status(200).json(accounts);
}
