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
// Grave o reincidencia: provisional hasta que se confirme la eliminación de la cuenta.
export function decideSanction({ role, severity, priorModerate, now }: DecisionInput): SanctionDecision {
  const enforced = role === "usuario_regular";
  const status: AccountSanctionStatus = enforced ? "active" : "pending_review";

  if (priorModerate || severity === "severe") return { kind: "provisional", status, warning: false, endsAt: null };

  const moderate = severity === "moderate";
  const endsAt = enforced ? (moderate ? addCalendarMonthUtc(now) : addDays(now, MILD_SUSPENSION_DAYS)) : null;
  return { kind: "temporary", status, warning: moderate, endsAt };
}

interface SanctionCase {
  status: AccountSanctionStatus;
  severity: AccountReportSeverity;
  kind: AccountSanctionKind;
}

// provisional por reincidencia (no por denuncias graves)
export function isRecidivism(sanction: Pick<SanctionCase, "kind" | "severity">): boolean {
  return sanction.kind === "provisional" && sanction.severity !== "severe";
}

// admin: cualquier caso; moderador: solo la reincidencia vigente de un usuario regular
export function canDecide(actorRole: Role, sanction: SanctionCase, targetRole: Role): boolean {
  if (actorRole === "admin") return true;
  return (
    actorRole === "moderador" &&
    targetRole === "usuario_regular" &&
    sanction.status === "active" &&
    isRecidivism(sanction)
  );
}

export type ConfirmationPlan = { action: "delete_account" } | { action: "sanction"; decision: SanctionDecision };

// Efecto de confirmar un caso de la cola: provisional vigente -> eliminación de la cuenta;
// staff en revisión -> la sanción normal por gravedad (la provisional sigue provisional).
export function planConfirmation(sanction: SanctionCase, now: Date): ConfirmationPlan {
  if (sanction.status === "active") return { action: "delete_account" };
  if (sanction.kind !== "temporary") {
    return { action: "sanction", decision: { kind: "provisional", status: "active", warning: false, endsAt: null } };
  }
  return {
    action: "sanction",
    decision: decideSanction({ role: "usuario_regular", severity: sanction.severity, priorModerate: false, now }),
  };
}
