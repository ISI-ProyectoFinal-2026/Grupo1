import { addCalendarMonthUtc, addDays, decideSanction, planConfirmation, resolveSeverity } from "../../src/services/account-sanctions/policy";

const NOW = new Date("2026-03-10T12:00:00.000Z");

describe("resolveSeverity", () => {
  test.each([
    [["mild", "mild", "mild", "moderate", "severe"], "mild"],
    [["mild", "mild", "moderate", "moderate", "severe"], "moderate"],
    [["mild", "mild", "severe", "severe", "moderate"], "severe"],
  ] as const)("con %j resuelve %s (más frecuente; empate, la más alta)", (severities, expected) => {
    expect(resolveSeverity([...severities])).toBe(expected);
  });
});

describe("duraciones", () => {
  test("addDays suma días corridos", () => {
    expect(addDays(NOW, 14).toISOString()).toBe("2026-03-24T12:00:00.000Z");
  });

  test.each([
    ["2026-03-10T12:00:00.000Z", "2026-04-10T12:00:00.000Z"],
    ["2026-01-31T08:30:00.000Z", "2026-02-28T08:30:00.000Z"],
    ["2028-01-31T08:30:00.000Z", "2028-02-29T08:30:00.000Z"],
    ["2026-12-15T00:00:00.000Z", "2027-01-15T00:00:00.000Z"],
    ["2026-08-31T23:59:59.000Z", "2026-09-30T23:59:59.000Z"],
  ])("addCalendarMonthUtc(%s) = %s", (from, expected) => {
    expect(addCalendarMonthUtc(new Date(from)).toISOString()).toBe(expected);
  });
});

describe("decideSanction", () => {
  const regular = { role: "usuario_regular" as const, priorModerate: false, now: NOW };

  test("leve: suspensión temporal de 14 días", () => {
    expect(decideSanction({ ...regular, severity: "mild" })).toEqual({
      kind: "temporary",
      status: "active",
      warning: false,
      endsAt: new Date("2026-03-24T12:00:00.000Z"),
    });
  });

  test("moderada: un mes calendario con aviso de baja permanente", () => {
    expect(decideSanction({ ...regular, severity: "moderate" })).toEqual({
      kind: "temporary",
      status: "active",
      warning: true,
      endsAt: new Date("2026-04-10T12:00:00.000Z"),
    });
  });

  test("grave: suspensión provisional sin fin", () => {
    expect(decideSanction({ ...regular, severity: "severe" })).toEqual({
      kind: "provisional",
      status: "active",
      warning: false,
      endsAt: null,
    });
  });

  test.each(["mild", "moderate", "severe"] as const)("reincidencia (%s) con moderada previa: permanente", (severity) => {
    expect(decideSanction({ ...regular, severity, priorModerate: true })).toEqual({
      kind: "permanent",
      status: "active",
      warning: false,
      endsAt: null,
    });
  });

  test.each(["moderador", "admin"] as const)("%s no se suspende: queda pendiente de revisión", (role) => {
    expect(decideSanction({ ...regular, role, severity: "moderate" })).toEqual({
      kind: "temporary",
      status: "pending_review",
      warning: true,
      endsAt: null,
    });
    expect(decideSanction({ ...regular, role, severity: "severe" }).status).toBe("pending_review");
    expect(decideSanction({ ...regular, role, severity: "mild", priorModerate: true })).toMatchObject({
      kind: "permanent",
      status: "pending_review",
    });
  });
});

describe("planConfirmation", () => {
  const pending = { status: "pending_review", severity: "moderate", kind: "temporary" } as const;

  test("moderada de staff en revisión: pasa a activa con +1 mes y advertencia", () => {
    expect(planConfirmation(pending, NOW)).toEqual({
      kind: "temporary",
      status: "active",
      warning: true,
      endsAt: new Date("2026-04-10T12:00:00.000Z"),
    });
  });

  test("leve de staff en revisión: +14 días sin advertencia", () => {
    expect(planConfirmation({ ...pending, severity: "mild" }, NOW)).toEqual({
      kind: "temporary",
      status: "active",
      warning: false,
      endsAt: new Date("2026-03-24T12:00:00.000Z"),
    });
  });

  test("grave de staff en revisión: pasa a provisional activa", () => {
    expect(planConfirmation({ ...pending, severity: "severe", kind: "provisional" }, NOW)).toEqual({
      kind: "provisional",
      status: "active",
      warning: false,
      endsAt: null,
    });
  });

  test("reincidencia de staff en revisión: permanente", () => {
    expect(planConfirmation({ ...pending, kind: "permanent" }, NOW)).toEqual({
      kind: "permanent",
      status: "active",
      warning: false,
      endsAt: null,
    });
  });

  test("provisional activa: pasa a permanente", () => {
    expect(planConfirmation({ status: "active", severity: "severe", kind: "provisional" }, NOW)).toEqual({
      kind: "permanent",
      status: "active",
      warning: false,
      endsAt: null,
    });
  });
});
