import { AuthTokenType, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";

// Cuánto vale cada token. El de reset es corto a propósito: quien lo tenga
// puede tomar la cuenta. El de cancelación del reinicio de 2FA dura 7 días para
// cubrir las 72 h de espera con margen.
export const AUTH_TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 30 * 60 * 1000,
  two_factor_login: 5 * 60 * 1000,
  two_factor_reset: 30 * 60 * 1000,
  two_factor_reset_cancel: 7 * 24 * 60 * 60 * 1000,
};

export const INVALID_LINK_MESSAGE = "El enlace es inválido o expiró";

/** Error que se lanza cuando el token no sirve; por defecto, el genérico de links. */
export interface TokenError {
  message: string;
  code?: string;
}

function invalidTokenError(err?: TokenError): AppError {
  return new AppError(400, err?.message ?? INVALID_LINK_MESSAGE, undefined, err?.code);
}

/** En la base se guarda solo esto: con el hash no se puede reconstruir el link. */
export function hashAuthToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Emite un token nuevo y devuelve el valor en claro (lo único que viaja por
 * mail). En la misma transacción invalida los tokens pendientes del mismo tipo
 * del usuario, así solo el último link pedido sirve.
 */
export async function issueAuthToken(userId: number, type: AuthTokenType): Promise<string> {
  const rawToken = randomBytes(32).toString("base64url");
  const now = new Date();

  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } }),
    prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: hashAuthToken(rawToken),
        expiresAt: new Date(now.getTime() + AUTH_TOKEN_TTL_MS[type]),
      },
    }),
  ]);

  return rawToken;
}

/**
 * Cuándo se emitió el último token de ese tipo para el usuario (null si nunca
 * se emitió). Emitir invalida los anteriores pero no los borra, así que el
 * último token existe aunque ya esté usado o invalidado: es la base del
 * cooldown del reenvío, que se mide desde la emisión y no desde el uso.
 */
export async function latestAuthTokenCreatedAt(userId: number, type: AuthTokenType): Promise<Date | null> {
  const latest = await prisma.authToken.findFirst({
    where: { userId, type },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return latest?.createdAt ?? null;
}

/**
 * Devuelve el dueño de un token vigente sin consumirlo. Sirve cuando el token
 * se usa más de una vez antes de gastarse (el desafío de login sobrevive a un
 * código equivocado o a un bloqueo).
 */
export async function findValidAuthToken(rawToken: string, type: AuthTokenType, err?: TokenError): Promise<number> {
  const token = await prisma.authToken.findFirst({
    where: { tokenHash: hashAuthToken(rawToken), type, usedAt: null, expiresAt: { gt: new Date() } },
    select: { userId: true },
  });
  if (!token) {
    throw invalidTokenError(err);
  }
  return token.userId;
}

/** Deja sin efecto los tokens pendientes de esos tipos del usuario. */
export async function invalidateAuthTokens(
  db: Prisma.TransactionClient,
  userId: number,
  types: AuthTokenType[]
): Promise<void> {
  await db.authToken.updateMany({ where: { userId, type: { in: types }, usedAt: null }, data: { usedAt: new Date() } });
}

/**
 * Consume un token dentro de la transacción del llamador y devuelve el id del
 * usuario dueño. El UPDATE condicional es lo que lo hace de un solo uso: si dos
 * requests llegan a la vez con el mismo token, solo una ve `count === 1`. El
 * llamador aplica el efecto (verificar, cambiar contraseña) en esa misma
 * transacción, así un error posterior deshace también el consumo.
 */
export async function consumeAuthToken(
  tx: Prisma.TransactionClient,
  rawToken: string,
  type: AuthTokenType,
  err?: TokenError
): Promise<number> {
  const tokenHash = hashAuthToken(rawToken);
  const now = new Date();

  const { count } = await tx.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (count !== 1) {
    throw invalidTokenError(err);
  }

  const token = await tx.authToken.findUniqueOrThrow({ where: { tokenHash }, select: { userId: true } });
  return token.userId;
}
