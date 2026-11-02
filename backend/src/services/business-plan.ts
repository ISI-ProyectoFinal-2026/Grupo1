import type { BusinessPlan } from "@prisma/client";

// Plan vigente calculado al leer: PREMIUM vencido o sin vencimiento cuenta como FREE (ADR-0024)
export function getEffectivePlan(plan: BusinessPlan, expiresAt: Date | null, now: Date = new Date()): BusinessPlan {
  return plan === "PREMIUM" && expiresAt !== null && expiresAt > now ? "PREMIUM" : "FREE";
}

// Suma meses en UTC; si el día no existe en el mes destino, usa el último (31/01 + 1 = 28/02)
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

// Con el plan vigente la renovación arranca en el vencimiento actual; si no, ahora
export function planPeriodStart(plan: BusinessPlan, expiresAt: Date | null, now: Date = new Date()): Date {
  return getEffectivePlan(plan, expiresAt, now) === "PREMIUM" ? expiresAt! : now;
}

export function nextPlanExpiry(plan: BusinessPlan, expiresAt: Date | null, months: number, now: Date = new Date()): Date {
  return addMonths(planPeriodStart(plan, expiresAt, now), months);
}
