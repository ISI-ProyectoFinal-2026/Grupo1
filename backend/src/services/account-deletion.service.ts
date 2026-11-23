import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { AccountDeleteInput } from "../validators/profile.validator";
import { activeSanctionWhere } from "./account-sanctions/active";
import { countOtherActiveAdmins } from "./account-sanctions/admins";
import { sanctionClock } from "./account-sanctions/clock";
import { applyAccountDeletionEffects } from "./account-sanctions/effects";
import { getEffectivePlan } from "./business-plan";
import { verifySecondFactor } from "./two-factor/verify";

type Db = Prisma.TransactionClient;

// bloqueos de la baja propia (#366); corre antes del 2FA y otra vez dentro de la transacción
async function assertCanDelete(db: Db, userId: number): Promise<void> {
  const now = sanctionClock.now();
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true, business: { select: { plan: true, planExpiresAt: true } } },
  });

  const openSanction = await db.accountSanction.findFirst({
    where: { userId, OR: [{ status: "pending_review" }, activeSanctionWhere(now)] },
    select: { id: true },
  });
  if (openSanction) {
    throw new AppError(409, "No podés eliminar tu cuenta con una sanción en curso", undefined, "ACCOUNT_SANCTION_OPEN");
  }

  if (user.role === "admin" && (await countOtherActiveAdmins(db, userId, now)) === 0) {
    throw new AppError(409, "No podés eliminar la cuenta del último administrador", undefined, "LAST_ADMIN");
  }

  if (user.business && getEffectivePlan(user.business.plan, user.business.planExpiresAt) === "PREMIUM") {
    throw new AppError(
      409,
      "Tu comercio tiene el plan Premium vigente; esperá a que venza para eliminar la cuenta",
      undefined,
      "ACTIVE_PREMIUM_BUSINESS"
    );
  }
}

// mismo lock que changeRole y las decisiones de sanciones: serializa el chequeo de último admin
async function lockRoleChange(tx: Db): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('role_change'))`;
}

async function deleteInTx(tx: Db, userId: number): Promise<void> {
  await lockRoleChange(tx);
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  await assertCanDelete(tx, userId);
  await tx.user.delete({ where: { id: userId } });
}

// baja propia: contraseña, 2FA si está activo, bloqueos y efectos después del commit
export async function deleteOwnAccount(userId: number, input: AccountDeleteInput): Promise<void> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, passwordHash: true, twoFactorEnabledAt: true },
  });
  if (!account) {
    throw new AppError(404, "Usuario no encontrado");
  }
  if (!(await bcrypt.compare(input.password, account.passwordHash))) {
    throw new AppError(403, "La contraseña es incorrecta", undefined, "INVALID_PASSWORD");
  }
  if (account.twoFactorEnabledAt && !input.code) {
    throw new AppError(400, "Ingresá el código de tu app de autenticación", undefined, "TWO_FACTOR_CODE_REQUIRED");
  }

  // antes del 2FA: un 409 no gasta el código ni suma fallos
  await assertCanDelete(prisma, userId);

  if (account.twoFactorEnabledAt) {
    // el lock va antes de que el 2FA bloquee la fila, como en changeRole; si no, deadlock
    await verifySecondFactor(
      userId,
      input.code!,
      { state: "enabled", allowRecovery: true, countFailures: true, beforeCheck: lockRoleChange },
      (tx) => deleteInTx(tx, userId)
    );
  } else {
    await prisma.$transaction((tx) => deleteInTx(tx, userId));
  }

  console.info(`[cuentas] cuenta ${userId} eliminada por su titular`);
  await applyAccountDeletionEffects({ userId, email: account.email });
}
