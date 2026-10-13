import { AuthTokenType, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../../db/client";
import { AppError } from "../../errors/app-error";
import { signAccessToken } from "../../utils/jwt";
import { toPublicUser } from "../../utils/public-user";
import {
  TwoFactorCodeInput,
  TwoFactorDisableInput,
  TwoFactorLoginInput,
} from "../../validators/two-factor.validator";
import { consumeAuthToken, findValidAuthToken, invalidateAuthTokens, issueAuthToken, TokenError } from "../auth-tokens.service";
import * as mailService from "../mail.service";
import { encryptSecret } from "./crypto";
import { buildOtpauthUri, generateTotpSecret } from "./totp";
import { generateRecoveryCodes, hashRecoveryCode, verifySecondFactor } from "./verify";

export const RESET_WAIT_HOURS = 72;
export const RESET_WAIT_MS = RESET_WAIT_HOURS * 60 * 60 * 1000;

/** Todos los tokens que dependen de que el 2FA esté activo: mueren al apagarlo. */
export const TWO_FACTOR_TOKEN_TYPES: AuthTokenType[] = ["two_factor_login", "two_factor_reset", "two_factor_reset_cancel"];

export const CHALLENGE_ERR: TokenError = {
  message: "La verificación expiró, iniciá sesión de nuevo",
  code: "TWO_FACTOR_CHALLENGE_INVALID",
};

/** Cuándo se completa un reinicio pedido en `requestedAt`. */
export function resetEffectiveAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + RESET_WAIT_MS);
}

/** Los avisos no son críticos: si el mail falla se loguea y el request sigue. */
export async function sendNotice(userId: number, what: string, send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch (error) {
    console.error(`[2fa] no se pudo enviar el aviso de ${what} al usuario ${userId}:`, error);
  }
}

/**
 * Limpia un reinicio pendiente y deja sin efecto sus links (confirmar y cancelar).
 * Devuelve si había algo que cancelar: el UPDATE condicional hace que, con dos
 * cancelaciones en paralelo, solo una vea `true` y mande el aviso.
 */
export async function cancelPendingReset(tx: Prisma.TransactionClient, userId: number): Promise<boolean> {
  const { count } = await tx.user.updateMany({
    where: { id: userId, twoFactorResetRequestedAt: { not: null } },
    data: { twoFactorResetRequestedAt: null },
  });
  await invalidateAuthTokens(tx, userId, ["two_factor_reset", "two_factor_reset_cancel"]);
  return count === 1;
}

/** Reemplaza el juego de códigos de recuperación y devuelve los nuevos en claro. */
async function replaceRecoveryCodes(tx: Prisma.TransactionClient, userId: number): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
  await tx.twoFactorRecoveryCode.createMany({
    data: codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })),
  });
  return codes;
}

/** Emite el desafío del primer paso; reemplaza al anterior del mismo usuario. */
export function issueLoginChallenge(userId: number): Promise<string> {
  return issueAuthToken(userId, "two_factor_login");
}

/**
 * Dueño de un desafío vigente, sin consumirlo. Si el usuario ya no tiene 2FA
 * activo (lo desactivó o se completó un reinicio) el desafío no vale.
 */
export async function findValidChallenge(rawToken: string): Promise<number> {
  const userId = await findValidAuthToken(rawToken, "two_factor_login", CHALLENGE_ERR);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabledAt: true } });
  if (!user?.twoFactorEnabledAt) {
    throw new AppError(400, CHALLENGE_ERR.message, undefined, CHALLENGE_ERR.code);
  }
  return userId;
}

/**
 * Segundo paso del login. El desafío se gasta solo si el código vale, dentro de
 * la misma transacción que la validación: un código equivocado o un bloqueo lo
 * dejan intacto. Con un código de recuperación se sube tokenVersion (las demás
 * sesiones mueren) y el JWT se firma con la fila ya actualizada.
 */
export async function loginWithSecondFactor(input: TwoFactorLoginInput) {
  const userId = await findValidChallenge(input.twoFactorToken);

  const { user, recoveryRemaining, resetCancelled } = await verifySecondFactor(
    userId,
    input.code,
    { state: "enabled", allowRecovery: true, countFailures: true },
    async (tx, proof) => {
      await consumeAuthToken(tx, input.twoFactorToken, "two_factor_login", CHALLENGE_ERR);
      // Quien entra con el segundo factor demuestra que la cuenta es suya: si había
      // un reinicio en espera, se cancela.
      const cancelled = await cancelPendingReset(tx, userId);

      if (proof.method === "recovery") {
        const bumped = await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
        const remaining = await tx.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } });
        return { user: bumped, recoveryRemaining: remaining, resetCancelled: cancelled };
      }

      const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      return { user: current, recoveryRemaining: null, resetCancelled: cancelled };
    }
  );

  if (recoveryRemaining !== null) {
    await sendNotice(user.id, "código de recuperación", () =>
      mailService.sendTwoFactorRecoveryCodeUsed(user.email, recoveryRemaining)
    );
  }
  if (resetCancelled) {
    await sendNotice(user.id, "cancelación del reinicio", () => mailService.sendTwoFactorResetCancelled(user.email));
  }

  return { token: signAccessToken(user), user: toPublicUser(user) };
}

export async function getStatus(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabledAt: true, twoFactorResetRequestedAt: true },
  });
  if (!user) {
    throw new AppError(404, "Usuario no encontrado");
  }

  const enabled = user.twoFactorEnabledAt !== null;
  const recoveryCodesRemaining = enabled
    ? await prisma.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } })
    : 0;
  const resetEffective =
    enabled && user.twoFactorResetRequestedAt ? resetEffectiveAt(user.twoFactorResetRequestedAt).toISOString() : null;

  return { enabled, recoveryCodesRemaining, resetEffectiveAt: resetEffective };
}

/**
 * Inicia el alta: guarda un secreto nuevo cifrado, todavía sin activar. Repetirlo
 * pisa el secreto pendiente. El secreto en claro solo viaja en esta respuesta.
 */
export async function setupTwoFactor(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, twoFactorEnabledAt: true },
  });
  if (!user) {
    throw new AppError(404, "Usuario no encontrado");
  }
  const alreadyEnabled = () =>
    new AppError(409, "El segundo factor ya está activado", undefined, "TWO_FACTOR_ALREADY_ENABLED");
  if (user.twoFactorEnabledAt) {
    throw alreadyEnabled();
  }

  const secret = generateTotpSecret();
  const encrypted = encryptSecret(secret, userId);
  // El WHERE cubre la carrera con un enable que termine entre la lectura y acá.
  const { count } = await prisma.user.updateMany({
    where: { id: userId, twoFactorEnabledAt: null },
    data: { twoFactorSecretEnc: encrypted },
  });
  if (count === 0) {
    throw alreadyEnabled();
  }

  return { secret, otpauthUri: buildOtpauthUri(secret, user.email) };
}

/**
 * Confirma el alta con un TOTP vigente. Los fallos no cuentan ni bloquean
 * (`countFailures: false`); el verificador deja registrado el paso aceptado, así
 * el mismo código no sirve después en el login.
 */
export async function enableTwoFactor(userId: number, input: TwoFactorCodeInput) {
  const { user, recoveryCodes } = await verifySecondFactor(
    userId,
    input.code,
    { state: "pending", allowRecovery: false, countFailures: false },
    async (tx) => {
      const enabled = await tx.user.update({
        where: { id: userId },
        data: { twoFactorEnabledAt: new Date(), tokenVersion: { increment: 1 } },
      });
      return { user: enabled, recoveryCodes: await replaceRecoveryCodes(tx, userId) };
    }
  );

  await sendNotice(userId, "activación", () => mailService.sendTwoFactorEnabled(user.email));

  return { token: signAccessToken(user), user: toPublicUser(user), recoveryCodes };
}

/**
 * Desactiva el 2FA. La contraseña se verifica primero y un fallo ahí es 403 sin
 * tocar el contador: un 401 desloguearía al usuario en el frontend. Limpia todo
 * rastro (reinicio pendiente, links y desafíos en vuelo) para que nada viejo
 * reviva el estado.
 */
export async function disableTwoFactor(userId: number, input: TwoFactorDisableInput) {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, twoFactorEnabledAt: true },
  });
  if (!account) {
    throw new AppError(404, "Usuario no encontrado");
  }
  if (!account.twoFactorEnabledAt) {
    throw new AppError(409, "El segundo factor no está activado", undefined, "TWO_FACTOR_NOT_ENABLED");
  }
  if (!(await bcrypt.compare(input.password, account.passwordHash))) {
    throw new AppError(403, "La contraseña es incorrecta", undefined, "INVALID_PASSWORD");
  }

  const user = await verifySecondFactor(
    userId,
    input.code,
    { state: "enabled", allowRecovery: true, countFailures: true },
    async (tx) => {
      const cleared = await tx.user.update({
        where: { id: userId },
        data: {
          twoFactorSecretEnc: null,
          twoFactorEnabledAt: null,
          twoFactorLastStep: null,
          twoFactorFailedAttempts: 0,
          twoFactorLockedUntil: null,
          twoFactorResetRequestedAt: null,
          tokenVersion: { increment: 1 },
        },
      });
      await tx.twoFactorRecoveryCode.deleteMany({ where: { userId } });
      await invalidateAuthTokens(tx, userId, TWO_FACTOR_TOKEN_TYPES);
      return cleared;
    }
  );

  await sendNotice(userId, "desactivación", () => mailService.sendTwoFactorDisabled(user.email));

  return { token: signAccessToken(user), user: toPublicUser(user) };
}

/** Reemplaza los códigos de recuperación. Pide un TOTP: un código de recuperación no vale. */
export async function regenerateRecoveryCodes(userId: number, input: TwoFactorCodeInput) {
  const { user, recoveryCodes } = await verifySecondFactor(
    userId,
    input.code,
    { state: "enabled", allowRecovery: false, countFailures: true },
    async (tx) => {
      const bumped = await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
      return { user: bumped, recoveryCodes: await replaceRecoveryCodes(tx, userId) };
    }
  );

  return { token: signAccessToken(user), user: toPublicUser(user), recoveryCodes };
}
