import { Request, Response } from "express";
import * as adminSanctionsService from "../services/admin-sanctions.service";
import { sanctionDecisionSchema, sanctionIdParamSchema } from "../validators/admin-sanctions.validator";

export async function listPending(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await adminSanctionsService.listPending());
}

export async function confirm(req: Request, res: Response): Promise<void> {
  const { id } = sanctionIdParamSchema.parse(req.params);
  const { reason } = sanctionDecisionSchema.parse(req.body);
  res.status(200).json(await adminSanctionsService.confirm(req.userId!, id, reason));
}

export async function revert(req: Request, res: Response): Promise<void> {
  const { id } = sanctionIdParamSchema.parse(req.params);
  const { reason } = sanctionDecisionSchema.parse(req.body);
  res.status(200).json(await adminSanctionsService.revert(req.userId!, id, reason));
}
