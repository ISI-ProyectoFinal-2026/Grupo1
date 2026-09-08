import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../errors/app-error";
import { verifyAccessToken } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError(401, "Se requiere un token de autenticación");
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, "El token expiró, iniciá sesión nuevamente");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError(401, "Token inválido");
    }
    throw error;
  }
}

/**
 * Autenticación opcional: si viene un token válido deja `req.userId` seteado,
 * y si no viene (o es inválido/expirado) deja pasar igual como visitante
 * anónimo. Se usa en endpoints públicos que necesitan distinguir al visitante
 * sin exigirle sesión — por ejemplo el perfil público de un comercio, donde
 * saber quién mira permite no contabilizar las visitas del propio dueño.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(authHeader.slice("Bearer ".length));
    req.userId = payload.sub;
  } catch {
    // Token inválido o expirado: se trata como visitante anónimo.
  }

  next();
}
