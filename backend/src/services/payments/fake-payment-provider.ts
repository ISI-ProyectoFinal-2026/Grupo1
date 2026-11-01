import { randomUUID } from "node:crypto";
import { ChargeInput, ChargeResult, PaymentProvider } from "./payment-provider";

// aprueba todo cobro sin pasarela; cualquier comercio obtiene Premium sin pagar (ADR-0024)
export class FakePaymentProvider implements PaymentProvider {
  async charge(_input: ChargeInput): Promise<ChargeResult> {
    return { status: "APPROVED", provider: "fake", reference: `fake-${randomUUID()}` };
  }
}
