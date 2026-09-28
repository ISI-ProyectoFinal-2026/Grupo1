import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Demasiados intentos, esperá un minuto" } },
  skip: () => process.env.NODE_ENV === "test",
});

// Endpoints de cuenta que mandan mails o prueban tokens de links: un cupo más
// largo que el del login frena tanto el spam de mails a un tercero como el
// intento de adivinar tokens. El contador es por IP y compartido entre ellos.
const accountLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Demasiados intentos, esperá unos minutos" } },
  skip: () => process.env.NODE_ENV === "test",
});

authRouter.post("/register", authLimiter, authController.register);
authRouter.post("/login", authLimiter, authController.login);
authRouter.get("/me", requireAuth, authController.me);

authRouter.post("/verify-email", accountLimiter, authController.verifyEmail);
authRouter.post("/verify-email/resend", accountLimiter, requireAuth, authController.resendEmailVerification);
authRouter.post("/forgot-password", accountLimiter, authController.forgotPassword);
authRouter.post("/reset-password", accountLimiter, authController.resetPassword);
