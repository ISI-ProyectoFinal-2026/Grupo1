import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { authenticateAccessToken, AuthUser } from "../services/session.service";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      // Datos de sesión que requireAuth/optionalAuth ya trajeron de la base:
      // los middlewares siguientes (rol, email verificado) los reusan.
      authUser?: AuthUser;
    }
  }
}

function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return undefined;
  }
  return authHeader.slice("Bearer ".length);
}

/**
 * Exige una sesión válida. No alcanza con que el JWT esté bien firmado: el
 * usuario tiene que seguir existiendo y el token tiene que ser de su versión
 * de sesión vigente (ver session.service.ts).
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new AppError(401, "Se requiere un token de autenticación");
  }

  const authUser = await authenticateAccessToken(token);
  req.userId = authUser.id;
  req.authUser = authUser;
  next();
}

/**
 * Autenticación opcional: si viene un token válido deja `req.userId` seteado,
 * y si no viene (o es inválido/expirado/de una sesión cerrada) deja pasar igual
 * como visitante anónimo. Se usa en endpoints públicos que necesitan distinguir
 * al visitante sin exigirle sesión — por ejemplo el perfil público de un
 * comercio, donde saber quién mira permite no contabilizar las visitas del
 * propio dueño. Solo se silencian los rechazos de autenticación: una falla de
 * infraestructura (ej. la base caída) se propaga como cualquier otro error.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);

  if (token) {
    try {
      const authUser = await authenticateAccessToken(token);
      req.userId = authUser.id;
      req.authUser = authUser;
    } catch (error) {
      if (!(error instanceof AppError)) {
        throw error;
      }
      // Token rechazado: se trata como visitante anónimo.
    }
  }

  next();
}

/**
 * Autorización por rol: debe usarse DESPUÉS de `requireAuth`, que es quien
 * deja `req.userId` seteado. El rol se resuelve siempre fresco contra la
 * base (no viaja en el JWT) para que un cambio de rol tenga efecto
 * inmediato, sin esperar a que el usuario vuelva a iniciar sesión. Si
 * requireAuth ya lo trajo en `req.authUser` se reusa y no se consulta de nuevo.
 */
export function requireRole(...roles: Role[]) {
  return async function (req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (!req.userId) {
      // Programación defensiva: requireRole asume que requireAuth ya corrió.
      throw new AppError(401, "Se requiere un token de autenticación");
    }

    const user =
      req.authUser ??
      (await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true },
      }));

    if (!user) {
      throw new AppError(401, "Usuario no encontrado");
    }

    if (!roles.includes(user.role)) {
      throw new AppError(403, "No tenés permiso para acceder a este recurso");
    }

    next();
  };
}

/**
 * Exige el email verificado: debe usarse DESPUÉS de `requireAuth`. Un usuario
 * sin verificar puede usar casi toda la app; esto se aplica solo a las acciones
 * que lo requieren (ej. registrar un comercio). El `code` le permite al
 * frontend ofrecer el reenvío del mail en vez de mostrar un error genérico.
 */
export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction): void {
  if (!req.authUser) {
    // Programación defensiva: requireVerifiedEmail asume que requireAuth ya corrió.
    throw new AppError(401, "Se requiere un token de autenticación");
  }

  if (!req.authUser.emailVerifiedAt) {
    throw new AppError(403, "Tenés que verificar tu email para hacer esto", undefined, "EMAIL_NOT_VERIFIED");
  }

  next();
}
