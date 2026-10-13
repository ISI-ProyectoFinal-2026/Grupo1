import { Request, Response } from "express";
import * as twoFactorService from "../services/two-factor/service";
import {
  twoFactorCodeSchema,
  twoFactorDisableSchema,
  twoFactorLoginSchema,
} from "../validators/two-factor.validator";

export async function login(req: Request, res: Response): Promise<void> {
  const data = twoFactorLoginSchema.parse(req.body);
  const result = await twoFactorService.loginWithSecondFactor(data);
  res.status(200).json(result);
}

export async function status(req: Request, res: Response): Promise<void> {
  res.status(200).json(await twoFactorService.getStatus(req.userId!));
}

export async function setup(req: Request, res: Response): Promise<void> {
  res.status(200).json(await twoFactorService.setupTwoFactor(req.userId!));
}

export async function enable(req: Request, res: Response): Promise<void> {
  const data = twoFactorCodeSchema.parse(req.body);
  res.status(200).json(await twoFactorService.enableTwoFactor(req.userId!, data));
}

export async function disable(req: Request, res: Response): Promise<void> {
  const data = twoFactorDisableSchema.parse(req.body);
  res.status(200).json(await twoFactorService.disableTwoFactor(req.userId!, data));
}

export async function regenerateRecoveryCodes(req: Request, res: Response): Promise<void> {
  const data = twoFactorCodeSchema.parse(req.body);
  res.status(200).json(await twoFactorService.regenerateRecoveryCodes(req.userId!, data));
}
