import { Prisma, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../../db/client";
import { AppError } from "../../errors/app-error";
import { frontendLink } from "../../utils/frontend-link";
import { TwoFactorResetRequestInput } from "../../validators/two-factor.validator";
import {
  consumeAuthToken,
  INVALID_LINK_MESSAGE,
  invalidateAuthTokens,
  issueAuthToken,
  issueAuthTokenIn,
  latestAuthTokenCreatedAt,
  TokenError,
} from "../auth-tokens.service";
import { assertMailConfigured } from "../mail";
import * as mailService from "../mail.service";
import {
  cancelPendingReset,
  resetEffectiveAt,
  RESET_WAIT_HOURS,
  sendNotice,
  TWO_FACTOR_TOKEN_TYPES,
  findValidChallenge,
} from "./service";
import { DB_NOW_UTC } from "./verify";

// Mínimo entre dos mails de confirmación del mismo usuario; se mide contra la
// base, como el reenvío de verificación, para que valga en todas las instancias.
const RESET_COOLDOWN_MS = 60_000;
const WAIT_INTERVAL = Prisma.raw(`interval '${RESET_WAIT_HOURS} hours'`);

export const LINK_ERR: TokenError = { message: INVALID_LINK_MESSAGE, code: "TWO_FACTOR_LINK_INVALID" };

/**
 * Pide el reinicio desde el segundo paso del login. Para llegar hace falta el
 * desafío vigente Y la contraseña; no cuenta contra el bloqueo (quien perdió el
 * dispositivo tiene que poder pedirlo justamente con la cuenta bloqueada) y no
 * gasta el desafío. El orden de los chequeos es parte del contrato: el de mail
 * va último para que un 503 no se anteponga a errores del propio usuario.
 */
export async function requestReset(input: TwoFactorResetRequestInput): Promise<{ alreadyPending: boolean }> {
  const userId = await findValidChallenge(input.twoFactorToken);
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, passwordHash: true, twoFactorResetRequestedAt: true },
  });

  if (!(await bcrypt.compare(input.password, account.passwordHash))) {
    throw new AppError(403, "La contraseña es incorrecta", undefined, "INVALID_PASSWORD");
  }

  // Con un reinicio en marcha no se manda otro mail ni se emite otro token: el
  // reloj no se puede reiniciar ni extender.
  if (account.twoFactorResetRequestedAt) {
    return { alreadyPending: true };
  }

  const lastIssuedAt = await latestAuthTokenCreatedAt(userId, "two_factor_reset");
  if (lastIssuedAt) {
    const elapsedMs = Date.now() - lastIssuedAt.getTime();
    if (elapsedMs < RESET_COOLDOWN_MS) {
      throw new AppError(
        429,
        "Esperá un minuto antes de pedir otro email",
        { retryAfterSeconds: Math.ceil((RESET_COOLDOWN_MS - elapsedMs) / 1000) },
        "TWO_FACTOR_RESET_COOLDOWN"
      );
    }
  }

  assertMailConfigured();

  // Un error de envío se propaga: el usuario lo pidió y tiene que saber que no le llegó.
  const token = await issueAuthToken(userId, "two_factor_reset");
  await mailService.sendTwoFactorResetLink(account.email, frontendLink("/two-factor/reset/confirm", token));
  return { alreadyPending: false };
}

/**
 * Confirma el link del mail y arranca la espera con la hora de la base. Es
 * idempotente: con un reinicio ya en marcha devuelve la fecha original y no
 * emite otro link de cancelación ni manda otro aviso. El link de cancelación
 * nace en la misma transacción que la espera, así no puede quedar una sin el otro.
 */
export async function confirmReset(rawToken: string): Promise<{ resetEffectiveAt: Date }> {
  const outcome = await prisma.$transaction(async (tx) => {
    const userId = await consumeAuthToken(tx, rawToken, "two_factor_reset", LINK_ERR);

    const account = await tx.user.findUnique({ where: { id: userId }, select: { twoFactorEnabledAt: true } });
    if (!account?.twoFactorEnabledAt) {
      throw new AppError(400, LINK_ERR.message, undefined, LINK_ERR.code);
    }

    const started = await tx.$executeRaw(Prisma.sql`
      UPDATE users SET two_factor_reset_requested_at = ${DB_NOW_UTC}
      WHERE id = ${userId} AND two_factor_reset_requested_at IS NULL
    `);
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, twoFactorResetRequestedAt: true },
    });
    const cancelToken = started === 1 ? await issueAuthTokenIn(tx, userId, "two_factor_reset_cancel") : null;

    return { userId, email: user.email, requestedAt: user.twoFactorResetRequestedAt as Date, cancelToken };
  });

  const effectiveAt = resetEffectiveAt(outcome.requestedAt);
  if (outcome.cancelToken) {
    const cancelLink = frontendLink("/two-factor/reset/cancel", outcome.cancelToken);
    await sendNotice(outcome.userId, "reinicio pendiente", () =>
      mailService.sendTwoFactorResetPending(outcome.email, cancelLink, effectiveAt)
    );
  }

  return { resetEffectiveAt: effectiveAt };
}

/** Cancela el reinicio desde el link del aviso; no necesita sesión. */
export async function cancelReset(rawToken: string): Promise<void> {
  const outcome = await prisma.$transaction(async (tx) => {
    const userId = await consumeAuthToken(tx, rawToken, "two_factor_reset_cancel", LINK_ERR);
    const cancelled = await cancelPendingReset(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    return { userId, email: user.email, cancelled };
  });

  if (outcome.cancelled) {
    await sendNotice(outcome.userId, "cancelación del reinicio", () =>
      mailService.sendTwoFactorResetCancelled(outcome.email)
    );
  }
}

/**
 * Cumplida la espera, el login con contraseña apaga el 2FA. Corre solo cuando la
 * contraseña ya pasó, ignora el bloqueo y no toca el secreto (no necesita la
 * clave de cifrado). Todo ocurre en una transacción con un UPDATE condicional:
 * con logins vencidos en paralelo solo uno lo aplica y avisa; los demás esperan
 * el bloqueo de fila, no tocan nada y releen la fila ya actualizada.
 * Devuelve siempre el usuario releído: con el 2FA apagado el llamador firma la
 * sesión con la tokenVersion nueva; si no, sigue con el segundo paso.
 */
export async function completeMaturedReset(userId: number): Promise<User> {
  const { user, completedNow } = await prisma.$transaction(async (tx) => {
    const completed = await tx.$executeRaw(Prisma.sql`
      UPDATE users SET
        two_factor_secret_enc = NULL,
        two_factor_enabled_at = NULL,
        two_factor_last_step = NULL,
        two_factor_failed_attempts = 0,
        two_factor_locked_until = NULL,
        two_factor_reset_requested_at = NULL,
        token_version = token_version + 1,
        updated_at = ${DB_NOW_UTC}
      WHERE id = ${userId}
        AND two_factor_enabled_at IS NOT NULL
        AND two_factor_reset_requested_at <= ${DB_NOW_UTC} - ${WAIT_INTERVAL}
    `);

    if (completed === 1) {
      await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
      await invalidateAuthTokens(tx, userId, TWO_FACTOR_TOKEN_TYPES);
    }

    return { user: await tx.user.findUniqueOrThrow({ where: { id: userId } }), completedNow: completed === 1 };
  });

  if (completedNow) {
    await sendNotice(user.id, "reinicio completado", () => mailService.sendTwoFactorResetCompleted(user.email));
  }

  return user;
}
