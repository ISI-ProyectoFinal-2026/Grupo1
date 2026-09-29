import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as uploadsController from "../controllers/uploads.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const uploadsRouter = Router();

const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Límite de uploads alcanzado, esperá un minuto" } },
  skip: () => process.env.NODE_ENV === "test",
});

uploadsRouter.post("/presign", uploadLimiter, requireAuth, uploadsController.presign);

// Each call runs ML inference on the AI service, so it gets its own budget.
const analyzeLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Límite de análisis de imágenes alcanzado, esperá un minuto" } },
  skip: () => process.env.NODE_ENV === "test",
});

uploadsRouter.post("/analyze", analyzeLimiter, requireAuth, uploadsController.analyze);
