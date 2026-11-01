import { FakePaymentProvider, getPaymentProvider } from "../../src/services/payments";

describe("FakePaymentProvider", () => {
  test("aprueba el cobro al instante con una referencia propia", async () => {
    const result = await new FakePaymentProvider().charge({ businessId: 1, amountUsd: 30, description: "Premium" });

    expect(result.status).toBe("APPROVED");
    expect(result.provider).toBe("fake");
    expect(result.reference).toMatch(/^fake-/);
  });

  test("cada cobro tiene una referencia distinta", async () => {
    const provider = new FakePaymentProvider();
    const input = { businessId: 1, amountUsd: 30, description: "Premium" };
    const [first, second] = await Promise.all([provider.charge(input), provider.charge(input)]);

    expect(first.reference).not.toBe(second.reference);
  });
});

describe("getPaymentProvider", () => {
  test("sin PAYMENT_PROVIDER usa el proveedor simulado", () => {
    expect(getPaymentProvider({})).toBeInstanceOf(FakePaymentProvider);
  });

  test("PAYMENT_PROVIDER=fake usa el proveedor simulado", () => {
    expect(getPaymentProvider({ PAYMENT_PROVIDER: "fake" })).toBeInstanceOf(FakePaymentProvider);
  });

  test("un proveedor desconocido falla con el nombre de la variable", () => {
    expect(() => getPaymentProvider({ PAYMENT_PROVIDER: "mercadopago" })).toThrow(/PAYMENT_PROVIDER/);
  });
});
