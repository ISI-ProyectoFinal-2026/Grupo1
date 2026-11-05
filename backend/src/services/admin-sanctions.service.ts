import { AccountReportSeverity, AccountSanctionKind, AccountSanctionStatus, Role } from "@prisma/client";
import { prisma } from "../db/client";
import { countBySeverity } from "./account-sanctions/policy";

// caso de la cola: nunca incluye denunciantes ni ids de denuncias (id = id de la sanción)
export interface SanctionQueueItem {
  id: number;
  account: { id: number; fullName: string | null; email: string };
  role: Role;
  kind: AccountSanctionKind;
  status: AccountSanctionStatus;
  severity: AccountReportSeverity;
  severityCounts: Record<AccountReportSeverity, number>;
  reportDates: Date[];
}

// casos por decidir: staff en revisión y suspensiones provisionales (eliminación por confirmar)
export async function listPending(): Promise<{ items: SanctionQueueItem[] }> {
  const sanctions = await prisma.accountSanction.findMany({
    where: { OR: [{ status: "pending_review" }, { status: "active", kind: "provisional" }] },
    include: {
      user: { select: { id: true, fullName: true, email: true, role: true } },
      reports: { select: { severity: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
  const items = sanctions.map((s) => ({
    id: s.id,
    account: { id: s.user.id, fullName: s.user.fullName, email: s.user.email },
    role: s.user.role,
    kind: s.kind,
    status: s.status,
    severity: s.severity,
    severityCounts: countBySeverity(s.reports.map((r) => r.severity)),
    reportDates: s.reports.map((r) => r.createdAt),
  }));
  return { items };
}
