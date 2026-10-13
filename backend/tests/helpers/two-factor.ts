import { prisma } from "../../src/db/client";
import { twoFactorClock } from "../../src/services/two-factor/clock";
import { encryptSecret } from "../../src/services/two-factor/crypto";
import { currentStep, generateTotpSecret, totpAt } from "../../src/services/two-factor/totp";
import { generateRecoveryCodes, hashRecoveryCode } from "../../src/services/two-factor/verify";

interface SeedTwoFactorOptions {
  /** false deja el alta iniciada y sin confirmar (secreto presente, 2FA apagado). */
  enabled?: boolean;
  recoveryCodes?: number;
  lastStep?: number | null;
  failedAttempts?: number;
  lockedUntil?: Date | null;
  resetRequestedAt?: Date | null;
}

/**
 * Deja al usuario con 2FA configurado directo en la base y devuelve el secreto
 * en claro y los códigos de recuperación, para poder generar entradas válidas
 * sin pasar por los endpoints de alta.
 */
export async function seedTwoFactor(
  userId: number,
  {
    enabled = true,
    recoveryCodes = 10,
    lastStep = null,
    failedAttempts = 0,
    lockedUntil = null,
    resetRequestedAt = null,
  }: SeedTwoFactorOptions = {}
): Promise<{ secret: string; recoveryCodes: string[] }> {
  const secret = generateTotpSecret();
  const codes = generateRecoveryCodes(recoveryCodes);

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecretEnc: encryptSecret(secret, userId),
      twoFactorEnabledAt: enabled ? new Date() : null,
      twoFactorLastStep: lastStep,
      twoFactorFailedAttempts: failedAttempts,
      twoFactorLockedUntil: lockedUntil,
      twoFactorResetRequestedAt: resetRequestedAt,
    },
  });
  await prisma.twoFactorRecoveryCode.deleteMany({ where: { userId } });
  if (codes.length > 0) {
    await prisma.twoFactorRecoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })),
    });
  }

  return { secret, recoveryCodes: codes };
}

/** Código TOTP del paso actual del reloj de 2FA, desplazado `offsetSteps` pasos. */
export function codeFor(secret: string, offsetSteps = 0, nowMs: number = twoFactorClock.now()): string {
  return totpAt(secret, currentStep(nowMs) + offsetSteps);
}

/** Un código de 6 dígitos que no sirve en ningún paso de la ventana actual. */
export function wrongCodeFor(secret: string, nowMs: number = twoFactorClock.now()): string {
  const valid = new Set([-2, -1, 0, 1, 2].map((offset) => codeFor(secret, offset, nowMs)));
  for (let candidate = 0; candidate < 1_000_000; candidate += 7919) {
    const code = String(candidate).padStart(6, "0");
    if (!valid.has(code)) {
      return code;
    }
  }
  throw new Error("No se encontró un código inválido");
}
