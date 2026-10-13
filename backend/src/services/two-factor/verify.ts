import { Prisma } from "@prisma/client";
import { createHash, randomInt } from "crypto";
import { prisma } from "../../db/client";
import { AppError } from "../../errors/app-error";
import { twoFactorClock } from "./clock";
import { decryptSecret } from "./crypto";
import { matchTotpStep } from "./totp";

// Las columnas de fecha son TIMESTAMP(3) sin zona y Prisma las guarda en UTC:
// un `now()` pelado depende del TimeZone de la sesión de Postgres y desfasa la
// comparación. Con esto la hora de la base queda en el mismo huso.
export const DB_NOW_UTC = Prisma.sql`(now() AT TIME ZONE 'UTC')`;

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const LOCK_SECONDS = LOCK_MINUTES * 60;
const LOCK_INTERVAL = Prisma.raw(`interval '${LOCK_MINUTES} minutes'`);
const RECOVERY_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const RECOVERY_CODE_LENGTH = 10;

export type SecondFactorMethod = "totp" | "recovery";

export interface SecondFactorProof {
  method: SecondFactorMethod;
  /** Secreto cifrado contra el que se validó el código, para que el llamador condicione su escritura a él. */
  secretEnc: string;
}

export interface SecondFactorOptions {
  /** `pending`: confirma el alta (secreto sin activar). `enabled`: 2FA ya activo. */
  state: "pending" | "enabled";
  allowRecovery: boolean;
  /** false: no mira el bloqueo ni cuenta fallos (confirmación del alta). */
  countFailures: boolean;
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

/** Códigos `XXXXX-XXXXX` de 50 bits, únicos dentro del lote. */
export function generateRecoveryCodes(count = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    let raw = "";
    for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
      raw += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    }
    codes.add(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return [...codes];
}

/** Señal interna: el código no valió. Al lanzarla se deshace la transacción. */
class CodeMismatch extends Error {}

function twoFactorError(status: number, message: string, code: string, details?: unknown): AppError {
  return new AppError(status, message, details, code);
}

function lockedError(retryAfterSeconds: number): AppError {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return twoFactorError(
    429,
    `Demasiados intentos fallidos, probá de nuevo en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`,
    "TWO_FACTOR_LOCKED",
    { retryAfterSeconds }
  );
}

function assertState(
  user: { twoFactorSecretEnc: string | null; twoFactorEnabledAt: Date | null },
  state: SecondFactorOptions["state"]
): string {
  if (state === "enabled") {
    if (!user.twoFactorEnabledAt || !user.twoFactorSecretEnc) {
      throw twoFactorError(409, "El segundo factor no está activado", "TWO_FACTOR_NOT_ENABLED");
    }
    return user.twoFactorSecretEnc;
  }

  if (user.twoFactorEnabledAt) {
    throw twoFactorError(409, "El segundo factor ya está activado", "TWO_FACTOR_ALREADY_ENABLED");
  }
  if (!user.twoFactorSecretEnc) {
    throw twoFactorError(409, "Primero iniciá la configuración del segundo factor", "TWO_FACTOR_NOT_SETUP");
  }
  return user.twoFactorSecretEnc;
}

/**
 * Suma un fallo ANTES de evaluar el código, en un único UPDATE atómico. El
 * bloqueo de fila serializa los intentos en paralelo: cuando el 5to deja el
 * `locked_until`, los siguientes ya no cumplen el WHERE y no evalúan nada. Con
 * el bloqueo vencido el contador arranca de nuevo en 1. Devuelve si este
 * intento dejó la cuenta bloqueada, o lanza 429 si ya lo estaba.
 */
async function registerAttempt(userId: number): Promise<{ locksNow: boolean }> {
  const attemptsBefore = Prisma.sql`(CASE WHEN two_factor_locked_until IS NOT NULL THEN 0 ELSE two_factor_failed_attempts END)`;
  const rows = await prisma.$queryRaw<Array<{ locked_until: Date | null }>>(Prisma.sql`
    UPDATE users SET
      two_factor_failed_attempts = ${attemptsBefore} + 1,
      two_factor_locked_until = CASE WHEN ${attemptsBefore} + 1 >= ${Prisma.raw(String(MAX_FAILED_ATTEMPTS))}
        THEN ${DB_NOW_UTC} + ${LOCK_INTERVAL}
        ELSE NULL END
    WHERE id = ${userId}
      AND (two_factor_locked_until IS NULL OR two_factor_locked_until <= ${DB_NOW_UTC})
    RETURNING two_factor_locked_until AS locked_until
  `);

  if (rows.length === 1) {
    return { locksNow: rows[0].locked_until !== null };
  }

  const [remaining] = await prisma.$queryRaw<Array<{ seconds: number }>>(Prisma.sql`
    SELECT GREATEST(1, CEIL(EXTRACT(EPOCH FROM (two_factor_locked_until - ${DB_NOW_UTC})))::int) AS seconds
    FROM users WHERE id = ${userId}
  `);
  throw lockedError(remaining?.seconds ?? 1);
}

async function checkCode(
  tx: Prisma.TransactionClient,
  userId: number,
  secret: string,
  code: string,
  lastStep: number | null,
  allowRecovery: boolean
): Promise<{ method: SecondFactorMethod } | null> {
  const step = matchTotpStep(secret, code, { nowMs: twoFactorClock.now(), lastStep });
  if (step !== null) {
    // El UPDATE condicional es lo que hace efectivo el anti-replay con requests
    // en paralelo: solo uno avanza el paso, el otro ve count === 0.
    const { count } = await tx.user.updateMany({
      where: { id: userId, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }] },
      data: { twoFactorLastStep: step },
    });
    return count === 1 ? { method: "totp" } : null;
  }

  if (!allowRecovery) {
    return null;
  }
  const normalized = normalizeRecoveryCode(code);
  if (!new RegExp(`^[A-Z2-7]{${RECOVERY_CODE_LENGTH}}$`).test(normalized)) {
    return null;
  }
  const { count } = await tx.twoFactorRecoveryCode.updateMany({
    where: { userId, codeHash: hashRecoveryCode(normalized), usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1 ? { method: "recovery" } : null;
}

/**
 * Único punto donde se valida un segundo factor (login, desactivar, regenerar
 * y confirmar el alta). El contador de fallos y el bloqueo se confirman FUERA
 * de la transacción para que un código inválido no los deshaga; la validación,
 * la contabilidad del éxito y los efectos del llamador (`onSuccess`) van en una
 * sola transacción, así un error de ese efecto deja el código sin gastar.
 */
export async function verifySecondFactor<T>(
  userId: number,
  code: string,
  opts: SecondFactorOptions,
  onSuccess: (tx: Prisma.TransactionClient, proof: SecondFactorProof) => Promise<T>
): Promise<T> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecretEnc: true, twoFactorEnabledAt: true, twoFactorLastStep: true },
  });
  if (!user) {
    throw twoFactorError(404, "Usuario no encontrado", "USER_NOT_FOUND");
  }

  const encryptedSecret = assertState(user, opts.state);
  // Antes de tocar el contador: una clave ausente o un secreto ilegible son
  // un problema del servidor y no deben gastarle intentos al usuario.
  const secret = decryptSecret(encryptedSecret, userId);

  const { locksNow } = opts.countFailures ? await registerAttempt(userId) : { locksNow: false };

  try {
    return await prisma.$transaction(async (tx) => {
      const proof = await checkCode(tx, userId, secret, code, user.twoFactorLastStep, opts.allowRecovery);
      if (!proof) {
        throw new CodeMismatch();
      }
      if (opts.countFailures) {
        await tx.user.update({ where: { id: userId }, data: { twoFactorFailedAttempts: 0, twoFactorLockedUntil: null } });
      }
      return onSuccess(tx, { ...proof, secretEnc: encryptedSecret });
    });
  } catch (error) {
    if (!(error instanceof CodeMismatch)) {
      throw error;
    }
    if (locksNow) {
      throw lockedError(LOCK_SECONDS);
    }
    throw twoFactorError(400, "El código es inválido o expiró", "INVALID_TWO_FACTOR_CODE");
  }
}
