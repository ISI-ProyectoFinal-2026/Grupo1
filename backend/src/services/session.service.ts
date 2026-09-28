import { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { verifyAccessToken } from "../utils/jwt";

/** Lo que el resto del backend sabe del usuario autenticado en cada request. */
export interface AuthUser {
  id: number;
  role: Role;
  emailVerifiedAt: Date | null;
  tokenVersion: number;
}

const AUTH_USER_SELECT = { id: true, role: true, emailVerifiedAt: true, tokenVersion: true } as const;

/**
 * Único punto donde se decide si un access token abre sesión. Lo usan
 * requireAuth, optionalAuth y el handshake del socket, así que cualquier regla
 * nueva de sesión (ej. rechazar cuentas suspendidas) se agrega acá una sola vez:
 * sumar el campo a AUTH_USER_SELECT y el chequeo después del de la versión.
 *
 * Además de la firma, valida contra la base que el usuario siga existiendo y
 * que la versión de sesión del token (`tv`) sea la vigente: restablecer la
 * contraseña la incrementa y deja sin efecto todos los tokens anteriores.
 */
export async function authenticateAccessToken(token: string): Promise<AuthUser> {
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, "El token expiró, iniciá sesión nuevamente");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError(401, "Token inválido");
    }
    throw error;
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError(401, "Token inválido");
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: AUTH_USER_SELECT });
  if (!user) {
    throw new AppError(401, "Token inválido");
  }

  const tokenVersion = typeof payload.tv === "number" ? payload.tv : 0;
  if (tokenVersion !== user.tokenVersion) {
    throw new AppError(401, "Tu sesión expiró, iniciá sesión de nuevo");
  }

  return user;
}
