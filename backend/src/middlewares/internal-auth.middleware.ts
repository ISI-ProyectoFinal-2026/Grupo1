import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";

/**
 * Autenticación server-to-server para endpoints internos (llamados por el
 * Backend IA, no por un usuario final). Valida el header `X-Internal-Key`
 * contra `INTERNAL_API_KEY`, la misma convención ya usada en el sentido
 * Node -> Backend IA (ver matching.service.ts).
 */
export function requireInternalKey(req: Request, _res: Response, next: NextFunction): void {
  const providedKey = req.headers["x-internal-key"];
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey || providedKey !== expectedKey) {
    throw new AppError(401, "No autorizado");
  }

  next();
}
