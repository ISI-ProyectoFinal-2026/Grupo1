import { AccountReportSeverity, AccountSanction, Prisma, Role } from "@prisma/client";
import { SANCTION_REASONS } from "./account-sanctions/active";
import { decideSanction, resolveSeverity } from "./account-sanctions/policy";

interface TriggeringReport {
  id: number;
  severity: AccountReportSeverity;
}

// sanción abierta (activa o en revisión) de la cuenta, si existe
export function findOpenSanction(tx: Prisma.TransactionClient, userId: number) {
  return tx.accountSanction.findFirst({ where: { userId, status: { in: ["active", "pending_review"] } } });
}

// registra el vencimiento de las suspensiones temporales ya cumplidas (actor sistema)
export async function expireDue(tx: Prisma.TransactionClient, userId: number, now: Date): Promise<void> {
  const due = await tx.accountSanction.findMany({
    where: { userId, status: "active", endsAt: { lte: now } },
    select: { id: true },
  });
  if (due.length === 0) return;
  const ids = due.map((s) => s.id);
  await tx.accountSanction.updateMany({ where: { id: { in: ids }, status: "active" }, data: { status: "expired" } });
  await tx.accountSanctionEvent.createMany({
    data: ids.map((sanctionId) => ({ sanctionId, actorId: null, type: "expired" as const, reason: "expiry" })),
  });
}

// crea la sanción del umbral dentro de la transacción del reporte y cierra el ciclo
export async function createFromThreshold(
  tx: Prisma.TransactionClient,
  params: { userId: number; role: Role; reports: TriggeringReport[]; now: Date }
): Promise<AccountSanction> {
  const { userId, role, reports, now } = params;
  const severity = resolveSeverity(reports.map((r) => r.severity));
  const priorModerate =
    (await tx.accountSanction.count({ where: { userId, severity: "moderate", status: { in: ["active", "expired"] } } })) > 0;
  const decision = decideSanction({ role, severity, priorModerate, now });
  const reportIds = reports.map((r) => r.id);

  const sanction = await tx.accountSanction.create({
    data: {
      userId,
      severity,
      ...decision,
      reason: SANCTION_REASONS[severity],
      triggeringReportIds: reportIds,
      startsAt: now,
    },
  });
  await tx.accountSanctionEvent.create({ data: { sanctionId: sanction.id, actorId: null, type: "created" } });
  await tx.accountReport.updateMany({ where: { id: { in: reportIds } }, data: { sanctionId: sanction.id } });
  if (decision.status === "active") {
    await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  }
  return sanction;
}
