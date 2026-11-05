import { AccountReportSeverity, AccountSanctionKind, AccountSanctionStatus, Role } from "@prisma/client";

const SEVERITY_RANK: Record<AccountReportSeverity, number> = { mild: 1, moderate: 2, severe: 3 };
const DAY_MS = 24 * 60 * 60 * 1000;
export const MILD_SUSPENSION_DAYS = 14;

export function countBySeverity(severities: AccountReportSeverity[]): Record<AccountReportSeverity, number> {
  const counts: Record<AccountReportSeverity, number> = { mild: 0, moderate: 0, severe: 0 };
  for (const severity of severities) counts[severity]++;
  return counts;
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

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

// +1 mes calendario en UTC; si el mes siguiente es más corto, cae en su último día (31/ene -> 28/feb)
export function addCalendarMonthUtc(from: Date): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const lastDayOfNextMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  const result = new Date(from.getTime());
  result.setUTCDate(1);
  result.setUTCMonth(month + 1);
  result.setUTCDate(Math.min(from.getUTCDate(), lastDayOfNextMonth));
  return result;
}

export interface SanctionDecision {
  kind: AccountSanctionKind;
  status: AccountSanctionStatus;
  warning: boolean;
  endsAt: Date | null;
}

interface DecisionInput {
  role: Role;
  severity: AccountReportSeverity;
  priorModerate: boolean;
  now: Date;
}

// Sanción que corresponde al llegar al umbral. Solo el usuario regular se suspende
// automáticamente; moderador/admin quedan en pending_review para decisión de un admin.
export function decideSanction({ role, severity, priorModerate, now }: DecisionInput): SanctionDecision {
  const enforced = role === "usuario_regular";
  const status: AccountSanctionStatus = enforced ? "active" : "pending_review";

  if (priorModerate) return { kind: "permanent", status, warning: false, endsAt: null };
  if (severity === "severe") return { kind: "provisional", status, warning: false, endsAt: null };

  const moderate = severity === "moderate";
  const endsAt = enforced ? (moderate ? addCalendarMonthUtc(now) : addDays(now, MILD_SUSPENSION_DAYS)) : null;
  return { kind: "temporary", status, warning: moderate, endsAt };
}

interface ConfirmableSanction {
  status: AccountSanctionStatus;
  severity: AccountReportSeverity;
  kind: AccountSanctionKind;
}

// Efecto de confirmar un caso de la cola: provisional -> permanente; staff en revisión -> la
// sanción normal por gravedad (la reincidencia ya quedó fijada en el kind al crear el caso).
export function planConfirmation(sanction: ConfirmableSanction, now: Date): SanctionDecision {
  if (sanction.status === "active" || sanction.kind === "permanent") {
    return { kind: "permanent", status: "active", warning: false, endsAt: null };
  }
  return decideSanction({ role: "usuario_regular", severity: sanction.severity, priorModerate: false, now });
}
