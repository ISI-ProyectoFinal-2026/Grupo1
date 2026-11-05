import { prisma } from "../../db/client";
import { expireDue } from "../account-sanctions.service";
import { sanctionClock } from "./clock";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

// registra el vencimiento de todas las suspensiones temporales cumplidas; devuelve cuántas cuentas procesó
export async function expireDueSanctions(now: Date = sanctionClock.now()): Promise<number> {
  const due = await prisma.accountSanction.findMany({
    where: { status: "active", endsAt: { lte: now } },
    select: { userId: true },
    distinct: ["userId"],
  });
  for (const { userId } of due) {
    await prisma.$transaction(async (tx) => {
      // mismo lock que la denuncia: evita registrar el vencimiento dos veces
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      await expireDue(tx, userId, now);
    });
  }
  return due.length;
}

export function startSanctionExpirySweep(): NodeJS.Timeout {
  const timer = setInterval(() => {
    expireDueSanctions().catch((error) => {
      console.error("[sanciones] falló el barrido de vencimientos:", error);
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}
