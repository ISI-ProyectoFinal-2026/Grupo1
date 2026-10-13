import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { assertMailConfigured } from "../services/mail";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../validators/auth.validator";

const FORGOT_PASSWORD_MESSAGE = "Si el email está registrado, te enviamos un enlace para restablecer tu contraseña";

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

export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getMe(req.userId!);
  res.status(200).json(user);
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = verifyEmailSchema.parse(req.body);
  await authService.verifyEmail(token);
  res.status(200).json({ message: "Tu email quedó verificado" });
}

export async function resendEmailVerification(req: Request, res: Response): Promise<void> {
  await authService.resendEmailVerification(req.userId!);
  res.status(200).json({ message: "Te mandamos un nuevo email de verificación" });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = forgotPasswordSchema.parse(req.body);

  // Antes de buscar al usuario y de responder: el correo mal configurado no
  // depende de la cuenta, así que el 503 es igual para cualquier email y no
  // revela cuáles existen. Callarlo con un 200 dejaría al usuario esperando un
  // mail que nunca va a llegar.
  assertMailConfigured();

  // Sin await a propósito: la respuesta sale igual y al mismo tiempo exista o
  // no la cuenta. Un error (base, SMTP) se loguea y no llega al cliente.
  authService.requestPasswordReset(email).catch((error) => {
    console.error("[auth] no se pudo procesar el pedido de reset de contraseña:", error);
  });

  res.status(200).json({ message: FORGOT_PASSWORD_MESSAGE });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const data = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(data);
  res.status(200).json({ message: "Tu contraseña se actualizó, iniciá sesión con la nueva" });
}
