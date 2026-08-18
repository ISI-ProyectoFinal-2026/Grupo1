import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/auth.controller";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Demasiados intentos, esperá un minuto" } },
  skip: () => process.env.NODE_ENV === "test",
});

authRouter.post("/register", authLimiter, authController.register);
authRouter.post("/login", authLimiter, authController.login);
