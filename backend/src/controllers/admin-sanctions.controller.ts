import { Request, Response } from "express";
import * as adminSanctionsService from "../services/admin-sanctions.service";

export async function listPending(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await adminSanctionsService.listPending());
}
