import { Request, Response } from "express";
import * as twoFactorService from "../services/two-factor/service";
import { twoFactorLoginSchema } from "../validators/two-factor.validator";

export async function login(req: Request, res: Response): Promise<void> {
  const data = twoFactorLoginSchema.parse(req.body);
  const result = await twoFactorService.loginWithSecondFactor(data);
  res.status(200).json(result);
}
