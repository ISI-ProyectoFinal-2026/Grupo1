import { AccountReport, AccountReportSeverity, Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { CreateAccountReportInput } from "../validators/account-reports.validator";
import * as accountSanctionsService from "./account-sanctions.service";

export const ACCOUNT_REPORT_THRESHOLD = 5;

const SEVERITY_RANK: Record<AccountReportSeverity, number> = { mild: 1, moderate: 2, severe: 3 };

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// la más frecuente; en empate, la más alta
export function resolveSeverity(severities: AccountReportSeverity[]): AccountReportSeverity {
  const counts = countBySeverity(severities);
  return (Object.keys(SEVERITY_RANK) as AccountReportSeverity[]).reduce((best, current) =>
    counts[current] > counts[best] || (counts[current] === counts[best] && SEVERITY_RANK[current] > SEVERITY_RANK[best])
      ? current
      : best
  );
}

function countBySeverity(severities: AccountReportSeverity[]): Record<AccountReportSeverity, number> {
  const counts: Record<AccountReportSeverity, number> = { mild: 0, moderate: 0, severe: 0 };
  for (const severity of severities) counts[severity]++;
  return counts;
}

export async function create(reporterId: number, data: CreateAccountReportInput): Promise<AccountReport> {
  if (data.reportedUserId === reporterId) {
    throw new AppError(403, "No podés reportar tu propia cuenta");
  }

  let report: AccountReport;
  let thresholdSeverity: AccountReportSeverity | null = null;
  try {
    ({ report, thresholdSeverity } = await prisma.$transaction(async (tx) => {
      // lock de la cuenta: serializa denuncias simultáneas para que el umbral se dispare una sola vez
      const locked = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM users WHERE id = ${data.reportedUserId} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new AppError(404, "Cuenta no encontrada");
      }

      const created = await tx.accountReport.create({
        data: { reportedUserId: data.reportedUserId, reporterId, severity: data.severity },
      });

      const all = await tx.accountReport.findMany({
        where: { reportedUserId: data.reportedUserId },
        select: { severity: true },
      });
      const severity = all.length === ACCOUNT_REPORT_THRESHOLD ? resolveSeverity(all.map((r) => r.severity)) : null;
      return { report: created, thresholdSeverity: severity };
    }));
  } catch (error) {
    if (isPrismaKnownError(error, "P2002")) {
      throw new AppError(409, "Ya reportaste esta cuenta");
    }
    throw error;
  }

  if (thresholdSeverity !== null) {
    try {
      await accountSanctionsService.onAccountReportThreshold(data.reportedUserId, thresholdSeverity);
    } catch (error) {
      console.error(`[account-reports] no se pudo disparar la sanción de la cuenta ${data.reportedUserId}:`, error);
    }
  }

  return report;
}

export interface ReportedAccountSummary {
  reportedUser: { id: number; fullName: string | null };
  reportCount: number;
  severityCounts: Record<AccountReportSeverity, number>;
  thresholdReached: boolean;
  resultingSeverity: AccountReportSeverity | null;
  lastReportedAt: Date;
}

// vista de moderación: una fila por cuenta, las más denunciadas primero
export async function list(): Promise<ReportedAccountSummary[]> {
  const reports = await prisma.accountReport.findMany({
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
