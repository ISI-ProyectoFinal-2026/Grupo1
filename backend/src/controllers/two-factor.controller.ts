import { Request, Response } from "express";
import * as twoFactorReset from "../services/two-factor/reset";
import * as twoFactorService from "../services/two-factor/service";
import {
  twoFactorCodeSchema,
  twoFactorDisableSchema,
  twoFactorLoginSchema,
  twoFactorResetLinkSchema,
  twoFactorResetRequestSchema,
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

export async function requestReset(req: Request, res: Response): Promise<void> {
  const data = twoFactorResetRequestSchema.parse(req.body);
  const { alreadyPending } = await twoFactorReset.requestReset(data);
  res.status(200).json({
    message: alreadyPending
      ? "Ya hay un reinicio del segundo factor en curso, revisá tu email"
      : "Te mandamos un email para confirmar el reinicio del segundo factor",
  });
}

export async function confirmReset(req: Request, res: Response): Promise<void> {
  const { token } = twoFactorResetLinkSchema.parse(req.body);
  const { resetEffectiveAt } = await twoFactorReset.confirmReset(token);
  res.status(200).json({
    message: "Confirmaste el reinicio del segundo factor, se completa cuando termine la espera",
    resetEffectiveAt: resetEffectiveAt.toISOString(),
  });
}

export async function cancelReset(req: Request, res: Response): Promise<void> {
  const { token } = twoFactorResetLinkSchema.parse(req.body);
  await twoFactorReset.cancelReset(token);
  res.status(200).json({ message: "Cancelaste el reinicio del segundo factor" });
}
