import { addMonths, getEffectivePlan, nextPlanExpiry, planPeriodStart } from "../../src/services/business-plan";

const now = new Date("2026-11-01T12:00:00.000Z");

describe("getEffectivePlan", () => {
  test("PREMIUM con vencimiento futuro sigue vigente", () => {
    expect(getEffectivePlan("PREMIUM", new Date("2026-12-01T00:00:00.000Z"), now)).toBe("PREMIUM");
  });

  test("PREMIUM vencido cuenta como FREE", () => {
    expect(getEffectivePlan("PREMIUM", new Date("2026-10-31T00:00:00.000Z"), now)).toBe("FREE");
  });

  test("PREMIUM que vence justo ahora cuenta como FREE", () => {
    expect(getEffectivePlan("PREMIUM", now, now)).toBe("FREE");
  });

  test("PREMIUM sin vencimiento cuenta como FREE", () => {
    expect(getEffectivePlan("PREMIUM", null, now)).toBe("FREE");
  });

  test("FREE sigue siendo FREE", () => {
    expect(getEffectivePlan("FREE", new Date("2026-12-01T00:00:00.000Z"), now)).toBe("FREE");
  });
});

describe("addMonths", () => {
  test("suma meses conservando el día", () => {
    expect(addMonths(new Date("2026-11-15T10:00:00.000Z"), 1).toISOString()).toBe("2026-12-15T10:00:00.000Z");
    expect(addMonths(new Date("2026-11-15T10:00:00.000Z"), 12).toISOString()).toBe("2027-11-15T10:00:00.000Z");
  });

  test("ajusta al último día cuando el mes destino es más corto", () => {
    expect(addMonths(new Date("2027-01-31T10:00:00.000Z"), 1).toISOString()).toBe("2027-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2028-02-29T10:00:00.000Z"), 12).toISOString()).toBe("2029-02-28T10:00:00.000Z");
  });
});

describe("nextPlanExpiry", () => {
  test("sin plan vigente cuenta el período desde ahora", () => {
    expect(nextPlanExpiry("FREE", null, 1, now).toISOString()).toBe("2026-12-01T12:00:00.000Z");
    expect(
      nextPlanExpiry("PREMIUM", new Date("2026-10-01T00:00:00.000Z"), 12, now).toISOString()
    ).toBe("2027-11-01T12:00:00.000Z");
  });

  test("con el plan vigente suma el período al vencimiento actual", () => {
    const currentExpiry = new Date("2026-11-20T00:00:00.000Z");
    expect(nextPlanExpiry("PREMIUM", currentExpiry, 1, now).toISOString()).toBe("2026-12-20T00:00:00.000Z");
  });
});

describe("planPeriodStart", () => {
  test("sin plan vigente el período arranca ahora", () => {
    expect(planPeriodStart("FREE", null, now)).toEqual(now);
  });

  test("con el plan vigente arranca en el vencimiento actual", () => {
    const currentExpiry = new Date("2026-11-20T00:00:00.000Z");
    expect(planPeriodStart("PREMIUM", currentExpiry, now)).toEqual(currentExpiry);
  });
});
