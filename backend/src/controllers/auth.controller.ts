import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { loginSchema, registerSchema } from "../validators/auth.validator";

export async function register(req: Request, res: Response): Promise<void> {
  const data = registerSchema.parse(req.body);
  const user = await authService.register(data);
  res.status(201).json(user);
}

export async function login(req: Request, res: Response): Promise<void> {
  const data = loginSchema.parse(req.body);
  const result = await authService.login(data);
  res.status(200).json(result);
}
