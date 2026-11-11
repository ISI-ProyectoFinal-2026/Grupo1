import {
  addCalendarMonthUtc,
  addDays,
  canDecide,
  decideSanction,
  isRecidivism,
  planConfirmation,
  resolveSeverity,
} from "../../src/services/account-sanctions/policy";

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

  test("moderada: un mes calendario con aviso de eliminación de la cuenta", () => {
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

  test.each(["mild", "moderate", "severe"] as const)(
    "reincidencia (%s) con moderada previa: suspensión provisional a revisión, nunca permanente",
    (severity) => {
      expect(decideSanction({ ...regular, severity, priorModerate: true })).toEqual({
        kind: "provisional",
        status: "active",
        warning: false,
        endsAt: null,
      });
    }
  );

  test.each(["moderador", "admin"] as const)("%s no se suspende: queda pendiente de revisión", (role) => {
    expect(decideSanction({ ...regular, role, severity: "moderate" })).toEqual({
      kind: "temporary",
      status: "pending_review",
      warning: true,
      endsAt: null,
    });
    expect(decideSanction({ ...regular, role, severity: "severe" }).status).toBe("pending_review");
    expect(decideSanction({ ...regular, role, severity: "mild", priorModerate: true })).toMatchObject({
      kind: "provisional",
      status: "pending_review",
    });
  });
});

describe("planConfirmation", () => {
  const pending = { status: "pending_review", severity: "moderate", kind: "temporary" } as const;
  const sanctionWith = (decision: object) => ({ action: "sanction", decision });

  test("moderada de staff en revisión: pasa a activa con +1 mes y advertencia", () => {
    expect(planConfirmation(pending, NOW)).toEqual(
      sanctionWith({ kind: "temporary", status: "active", warning: true, endsAt: new Date("2026-04-10T12:00:00.000Z") })
    );
  });

  test("leve de staff en revisión: +14 días sin advertencia", () => {
    expect(planConfirmation({ ...pending, severity: "mild" }, NOW)).toEqual(
      sanctionWith({ kind: "temporary", status: "active", warning: false, endsAt: new Date("2026-03-24T12:00:00.000Z") })
    );
  });

  test.each(["severe", "mild"] as const)("provisional (%s) de staff en revisión: pasa a provisional activa", (severity) => {
    expect(planConfirmation({ ...pending, severity, kind: "provisional" }, NOW)).toEqual(
      sanctionWith({ kind: "provisional", status: "active", warning: false, endsAt: null })
    );
  });

  test.each(["severe", "moderate", "mild"] as const)("provisional activa (%s): elimina la cuenta", (severity) => {
    expect(planConfirmation({ status: "active", severity, kind: "provisional" }, NOW)).toEqual({ action: "delete_account" });
  });
});

describe("isRecidivism", () => {
  test.each([
    ["provisional", "mild", true],
    ["provisional", "moderate", true],
    ["provisional", "severe", false],
    ["temporary", "moderate", false],
  ] as const)("%s %s -> %s", (kind, severity, expected) => {
    expect(isRecidivism({ kind, severity })).toBe(expected);
  });
});

describe("canDecide", () => {
  const recidivism = { status: "active", kind: "provisional", severity: "moderate" } as const;
  const severe = { status: "active", kind: "provisional", severity: "severe" } as const;
  const staffPending = { status: "pending_review", kind: "provisional", severity: "mild" } as const;

  test("el admin decide cualquier caso", () => {
    for (const sanction of [recidivism, severe, staffPending]) {
      expect(canDecide("admin", sanction, "usuario_regular")).toBe(true);
    }
  });

  test("el moderador decide la reincidencia de un usuario regular", () => {
    expect(canDecide("moderador", recidivism, "usuario_regular")).toBe(true);
  });

  test("el moderador no decide casos graves, de staff ni sobre cuentas de staff", () => {
    expect(canDecide("moderador", severe, "usuario_regular")).toBe(false);
    expect(canDecide("moderador", staffPending, "moderador")).toBe(false);
    expect(canDecide("moderador", recidivism, "moderador")).toBe(false);
    expect(canDecide("moderador", recidivism, "admin")).toBe(false);
  });

  test("un usuario regular no decide nada", () => {
    expect(canDecide("usuario_regular", recidivism, "usuario_regular")).toBe(false);
  });
});
