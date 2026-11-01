// puerto de cobro: la pasarela real reemplaza al proveedor simulado (ADR-0024)
export interface ChargeInput {
  businessId: number;
  amountUsd: number;
  description: string;
}

export interface ChargeResult {
  status: "APPROVED" | "REJECTED";
  provider: string;
  reference: string;
}

export interface PaymentProvider {
  charge(input: ChargeInput): Promise<ChargeResult>;
}
