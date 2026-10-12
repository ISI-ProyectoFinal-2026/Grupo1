import { Request } from "express";
import rateLimit from "express-rate-limit";

// Techo por IP para toda la API: alto a propósito, porque una sesión normal
// (feed, detalle, chat, notificaciones) hace muchas requests chicas. Frena
// scraping y floods sin afectar el uso real. Los limiters más estrictos de
// cada ruta (auth, uploads, flyer, creación de reportes) se suman a este.
export const GLOBAL_RATE_LIMIT = 300;

// Cada reporte creado con foto dispara la inferencia del Backend IA, que es lo
// más caro del sistema. 10 por cuarto de hora sobra para un uso real.
export const REPORT_CREATE_RATE_LIMIT = 10;

export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: GLOBAL_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Demasiadas solicitudes, esperá un minuto" } },
  skip: () => process.env.NODE_ENV === "test",
});

// Va después de requireAuth: el cupo es por usuario y no por IP, para no
// bloquear a varios usuarios que comparten red (NAT, wifi pública).
export const reportCreateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: REPORT_CREATE_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `user:${req.userId}`,
  message: { error: { message: "Límite de creación de reportes alcanzado, esperá unos minutos" } },
  skip: () => process.env.NODE_ENV === "test",
});
