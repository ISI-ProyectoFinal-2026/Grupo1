import cors from "cors";
import express from "express";
import helmet from "helmet";
import { healthRouter } from "./routes/health.routes";
import { authRouter } from "./routes/auth.routes";
import { petsRouter } from "./routes/pets.routes";
import { uploadsRouter } from "./routes/uploads.routes";
import { reportsRouter } from "./routes/reports.routes";
import { reportFlagsRouter } from "./routes/report-flags.routes";
import { geoRouter } from "./routes/geo.routes";
import { businessesRouter } from "./routes/businesses.routes";
import { chatsRouter } from "./routes/chats.routes";
import { notificationsRouter } from "./routes/notifications.routes";
import { errorHandler } from "./middlewares/error-handler";
import { applyTrustProxy } from "./config/trust-proxy";
import { globalLimiter } from "./middlewares/rate-limit";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET no está definida. Configurá la variable de entorno antes de iniciar el servidor.");
}

export const app = express();

// Antes que cualquier middleware: los rate limiters usan req.ip como key.
applyTrustProxy(app, process.env.TRUST_PROXY);

// Primero, para que también las respuestas de error (404, 429) lleven los headers.
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

// Fuera de /api y antes del limiter global: las sondas de liveness/readiness
// no pueden quedar bloqueadas por el tráfico de la API.
app.use("/health", healthRouter);

app.use("/api", globalLimiter);
app.use("/api/auth", authRouter);
app.use("/api/pets", petsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/report-flags", reportFlagsRouter);
app.use("/api/geo", geoRouter);
app.use("/api/businesses", businessesRouter);
app.use("/api/chats", chatsRouter);
app.use("/api/notifications", notificationsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { message: "Recurso no encontrado" } });
});

app.use(errorHandler);
