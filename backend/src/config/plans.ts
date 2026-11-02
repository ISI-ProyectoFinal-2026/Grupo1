import type { SubscriptionPeriod } from "@prisma/client";
import { getPaymentProvider } from "../services/payments";

// precios de Premium (ADR-0024)
const DEFAULT_MONTHLY_PRICE_USD = 30;
const DEFAULT_ANNUAL_PRICE_USD = 300;

export interface PlanOffer {
  plan: "PREMIUM";
  period: SubscriptionPeriod;
  months: number;
  priceUsd: number;
}

export const PERIOD_MONTHS: Record<SubscriptionPeriod, number> = { MONTHLY: 1, ANNUAL: 12 };

export function parsePlanPrice(name: string, raw: string | undefined, fallback: number): number {
  const value = raw?.trim() ?? "";
  if (value === "") {
    return fallback;
  }
  const price = /^\d+(\.\d{1,2})?$/.test(value) ? Number(value) : NaN;
  if (!(price > 0)) {
    throw new Error(`${name} inválida ("${value}"): usá un precio en USD mayor a 0 (ej. 30 o 29.99).`);
  }
  return price;
}

export function getPlanOffers(env: NodeJS.ProcessEnv = process.env): PlanOffer[] {
  return [
    {
      plan: "PREMIUM",
      period: "MONTHLY",
      months: PERIOD_MONTHS.MONTHLY,
      priceUsd: parsePlanPrice("PREMIUM_MONTHLY_PRICE_USD", env.PREMIUM_MONTHLY_PRICE_USD, DEFAULT_MONTHLY_PRICE_USD),
    },
    {
      plan: "PREMIUM",
      period: "ANNUAL",
      months: PERIOD_MONTHS.ANNUAL,
      priceUsd: parsePlanPrice("PREMIUM_ANNUAL_PRICE_USD", env.PREMIUM_ANNUAL_PRICE_USD, DEFAULT_ANNUAL_PRICE_USD),
    },
  ];
}

// se llama al arrancar: una configuración inválida corta el inicio en vez de dar 500 en cada compra
export function assertMonetizationConfig(env: NodeJS.ProcessEnv = process.env): void {
  getPlanOffers(env);
  getPaymentProvider(env);
}
