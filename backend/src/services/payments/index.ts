import { FakePaymentProvider } from "./fake-payment-provider";
import { PaymentProvider } from "./payment-provider";

export type { ChargeInput, ChargeResult, PaymentProvider } from "./payment-provider";
export { FakePaymentProvider } from "./fake-payment-provider";

// sin PAYMENT_PROVIDER se usa el simulado: es el único disponible
export function getPaymentProvider(env: NodeJS.ProcessEnv = process.env): PaymentProvider {
  const name = env.PAYMENT_PROVIDER?.trim() || "fake";
  if (name === "fake") {
    return new FakePaymentProvider();
  }
  throw new Error(`PAYMENT_PROVIDER inválida ("${name}"): el único proveedor disponible es "fake".`);
}
