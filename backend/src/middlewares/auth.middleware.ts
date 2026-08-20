import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../errors/app-error";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

interface AccessTokenPayload {
  sub: number;
  email: string;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError(401, "Se requiere un token de autenticación");
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as unknown as AccessTokenPayload;
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
