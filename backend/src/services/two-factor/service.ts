import { prisma } from "../../db/client";
import { AppError } from "../../errors/app-error";
import { signAccessToken } from "../../utils/jwt";
import { toPublicUser } from "../../utils/public-user";
import { TwoFactorLoginInput } from "../../validators/two-factor.validator";
import { consumeAuthToken, findValidAuthToken, issueAuthToken, TokenError } from "../auth-tokens.service";
import * as mailService from "../mail.service";
import { verifySecondFactor } from "./verify";

export const RESET_WAIT_MS = 72 * 60 * 60 * 1000;

export const CHALLENGE_ERR: TokenError = {
  message: "La verificación expiró, iniciá sesión de nuevo",
  code: "TWO_FACTOR_CHALLENGE_INVALID",
};

/** Cuándo se completa un reinicio pedido en `requestedAt`. */
export function resetEffectiveAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + RESET_WAIT_MS);
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

  const { user, recoveryRemaining } = await verifySecondFactor(
    userId,
    input.code,
    { state: "enabled", allowRecovery: true, countFailures: true },
    async (tx, proof) => {
      await consumeAuthToken(tx, input.twoFactorToken, "two_factor_login", CHALLENGE_ERR);

      if (proof.method === "recovery") {
        const bumped = await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
        const remaining = await tx.twoFactorRecoveryCode.count({ where: { userId, usedAt: null } });
        return { user: bumped, recoveryRemaining: remaining };
      }

      const current = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      return { user: current, recoveryRemaining: null };
    }
  );

  if (recoveryRemaining !== null) {
    try {
      await mailService.sendTwoFactorRecoveryCodeUsed(user.email, recoveryRemaining);
    } catch (error) {
      console.error(`[2fa] no se pudo enviar el aviso de código de recuperación al usuario ${user.id}:`, error);
    }
  }

  return { token: signAccessToken(user), user: toPublicUser(user) };
}
