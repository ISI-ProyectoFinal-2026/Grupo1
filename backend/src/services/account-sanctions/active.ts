import { AccountReportSeverity, AccountSanction, Prisma } from "@prisma/client";
import { AppError } from "../../errors/app-error";

// texto fijo por gravedad; nunca incluye denunciantes ni ids de denuncias
export const SANCTION_REASONS: Record<AccountReportSeverity, string> = {
  mild: "Tu cuenta fue suspendida por recibir denuncias de otros usuarios.",
  moderate: "Tu cuenta fue suspendida por recibir denuncias de otros usuarios de gravedad media.",
  severe: "Tu cuenta fue suspendida preventivamente por recibir denuncias graves de otros usuarios.",
};

// suspensión vigente: status active y (sin fin o fin posterior a now)
export function activeSanctionWhere(now: Date): Prisma.AccountSanctionWhereInput {
  return { status: "active", OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
}

// autor sin suspensión vigente, para filtrar SQL crudo
export function activeAuthorSql(userIdColumn: Prisma.Sql, now: Date): Prisma.Sql {
  return Prisma.sql`NOT EXISTS (
    SELECT 1 FROM account_sanctions s
    WHERE s.user_id = ${userIdColumn} AND s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at > ${now})
  )`;
}

export function toSuspendedError(sanction: Pick<AccountSanction, "kind" | "severity" | "endsAt" | "warning">): AppError {
  return new AppError(
    403,
    SANCTION_REASONS[sanction.severity],
    {
      type: sanction.kind,
      severity: sanction.severity,
      endsAt: sanction.endsAt ? sanction.endsAt.toISOString() : null,
      warning: sanction.warning,
    },
    "ACCOUNT_SUSPENDED"
  );
}
