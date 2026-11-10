import { AccountReport, AccountSanction, AccountReportSeverity, Prisma, Role } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { CreateAccountReportInput } from "../validators/account-reports.validator";
import * as accountSanctionsService from "./account-sanctions.service";
import { applySanctionEffects } from "./account-sanctions/effects";
import { sanctionClock } from "./account-sanctions/clock";
import { countBySeverity, resolveSeverity } from "./account-sanctions/policy";

export const ACCOUNT_REPORT_THRESHOLD = 5;

export { resolveSeverity };

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function create(reporterId: number, data: CreateAccountReportInput): Promise<AccountReport> {
  if (data.reportedUserId === reporterId) {
    throw new AppError(403, "No podés reportar tu propia cuenta");
  }

  try {
    const { created, sanction } = await prisma.$transaction(async (tx) => {
      // lock de la cuenta: serializa denuncias simultáneas para que el umbral se dispare una sola vez
      const locked = await tx.$queryRaw<{ id: number; role: Role }[]>`
        SELECT id, role FROM users WHERE id = ${data.reportedUserId} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new AppError(404, "Cuenta no encontrada");
      }

      const now = sanctionClock.now();
      await accountSanctionsService.expireDue(tx, data.reportedUserId, now);
      if (await accountSanctionsService.findOpenSanction(tx, data.reportedUserId)) {
        throw new AppError(409, "La cuenta ya tiene una sanción en curso");
      }

      const created = await tx.accountReport.create({
        data: { reportedUserId: data.reportedUserId, reporterId, severity: data.severity },
      });

      const open = await tx.accountReport.findMany({
        where: { reportedUserId: data.reportedUserId, sanctionId: null },
        select: { id: true, severity: true },
        orderBy: { id: "asc" },
      });
      let sanction: AccountSanction | null = null;
      if (open.length >= ACCOUNT_REPORT_THRESHOLD) {
        sanction = await accountSanctionsService.createFromThreshold(tx, {
          userId: data.reportedUserId,
          role: locked[0].role,
          reports: open.slice(0, ACCOUNT_REPORT_THRESHOLD),
          now,
        });
      }
      return { created, sanction };
    });
    if (sanction) await applySanctionEffects(sanction);
    return created;
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      throw new AppError(409, "Ya reportaste esta cuenta");
    }
    throw error;
  }
}

export interface ReportedAccountSummary {
  reportedUser: { id: number; fullName: string | null };
  reportCount: number;
  severityCounts: Record<AccountReportSeverity, number>;
  thresholdReached: boolean;
  resultingSeverity: AccountReportSeverity | null;
  lastReportedAt: Date;
}

// vista de moderación: denuncias del ciclo abierto, una fila por cuenta, las más denunciadas primero
export async function list(): Promise<ReportedAccountSummary[]> {
  const reports = await prisma.accountReport.findMany({
    where: { sanctionId: null },
    include: { reportedUser: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "asc" },
  });

  const byAccount = new Map<number, typeof reports>();
  for (const report of reports) {
    const group = byAccount.get(report.reportedUserId) ?? [];
    group.push(report);
    byAccount.set(report.reportedUserId, group);
  }

  return [...byAccount.values()]
    .map((group) => {
      // la gravedad se fija con las primeras 5, igual que al disparar la sanción
      const thresholdReached = group.length >= ACCOUNT_REPORT_THRESHOLD;
      return {
        reportedUser: group[0].reportedUser,
        reportCount: group.length,
        severityCounts: countBySeverity(group.map((r) => r.severity)),
        thresholdReached,
        resultingSeverity: thresholdReached
          ? resolveSeverity(group.slice(0, ACCOUNT_REPORT_THRESHOLD).map((r) => r.severity))
          : null,
        lastReportedAt: group[group.length - 1].createdAt,
      };
    })
    .sort((a, b) => b.reportCount - a.reportCount || b.lastReportedAt.getTime() - a.lastReportedAt.getTime());
}
