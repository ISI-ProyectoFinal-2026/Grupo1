import { AccountSanction, Prisma } from "@prisma/client";
import { sanctionClock } from "../../src/services/account-sanctions/clock";
import {
  activeAuthorSql,
  activeSanctionWhere,
  SANCTION_REASONS,
  toSuspendedError,
} from "../../src/services/account-sanctions/active";

const NOW = new Date("2026-11-05T12:00:00.000Z");

function sanction(overrides: Partial<AccountSanction> = {}): AccountSanction {
  return {
    id: 1,
    userId: 7,
    severity: "mild",
    kind: "temporary",
    status: "active",
    warning: false,
    reason: SANCTION_REASONS.mild,
    triggeringReportIds: [101, 102, 103, 104, 105],
    startsAt: NOW,
    endsAt: new Date("2026-11-19T12:00:00.000Z"),
    createdAt: NOW,
    ...overrides,
  };
}

describe("sanctionClock", () => {
  test("now() devuelve la hora actual y se puede fijar con spyOn", () => {
    const before = Date.now();
    const real = sanctionClock.now().getTime();
    expect(real).toBeGreaterThanOrEqual(before);
    expect(real).toBeLessThanOrEqual(Date.now());

    const spy = jest.spyOn(sanctionClock, "now").mockReturnValue(NOW);
    expect(sanctionClock.now()).toEqual(NOW);
    spy.mockRestore();
  });
});

describe("activeSanctionWhere", () => {
  test("exige estado active y fin nulo o posterior a now", () => {
    expect(activeSanctionWhere(NOW)).toEqual({
      status: "active",
      OR: [{ endsAt: null }, { endsAt: { gt: NOW } }],
    });
  });

  test("usa el now recibido", () => {
    const later = new Date("2027-01-01T00:00:00.000Z");
    expect(activeSanctionWhere(later).OR).toEqual([{ endsAt: null }, { endsAt: { gt: later } }]);
  });
});

describe("activeAuthorSql", () => {
  test("genera NOT EXISTS sobre la columna indicada con now como parámetro", () => {
    const fragment = activeAuthorSql(Prisma.sql`r.user_id`, NOW);

    expect(fragment.sql).toContain("NOT EXISTS");
    expect(fragment.sql).toContain("s.user_id = r.user_id");
    expect(fragment.sql).toContain("s.status = 'active'");
    expect(fragment.sql).toContain("s.ends_at IS NULL OR s.ends_at >");
    expect(fragment.values).toEqual([NOW]);
  });

  test("respeta otra columna", () => {
    const fragment = activeAuthorSql(Prisma.sql`b.user_id`, NOW);
    expect(fragment.sql).toContain("s.user_id = b.user_id");
    expect(fragment.sql).not.toContain("r.user_id");
  });
});

describe("toSuspendedError", () => {
  test("temporal: 403 ACCOUNT_SUSPENDED con tipo, fecha de fin y texto fijo", () => {
    const error = toSuspendedError(sanction());

    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("ACCOUNT_SUSPENDED");
    expect(error.message).toBe(SANCTION_REASONS.mild);
    expect(error.details).toEqual({
      type: "temporary",
      severity: "mild",
      endsAt: "2026-11-19T12:00:00.000Z",
      warning: false,
    });
  });

  test("moderada: incluye la advertencia de posible baja permanente", () => {
    const error = toSuspendedError(sanction({ severity: "moderate", warning: true, reason: SANCTION_REASONS.moderate }));
    expect(error.details).toMatchObject({ type: "temporary", severity: "moderate", warning: true });
    expect(error.message).toBe(SANCTION_REASONS.moderate);
  });

  test("permanente y provisoria: endsAt null", () => {
    const permanent = toSuspendedError(sanction({ kind: "permanent", endsAt: null }));
    const provisional = toSuspendedError(sanction({ kind: "provisional", severity: "severe", endsAt: null }));

    expect(permanent.details).toMatchObject({ type: "permanent", endsAt: null });
    expect(provisional.details).toMatchObject({ type: "provisional", severity: "severe", endsAt: null });
  });

  test("nunca expone ids de denuncias ni de denunciantes", () => {
    const error = toSuspendedError(sanction());
    const serialized = JSON.stringify({ message: error.message, details: error.details });

    expect(Object.keys(error.details as object).sort()).toEqual(["endsAt", "severity", "type", "warning"]);
    expect(serialized).not.toContain("101");
    expect(serialized).not.toContain("triggeringReportIds");
  });

  test("cada gravedad tiene un texto fijo distinto", () => {
    expect(new Set(Object.values(SANCTION_REASONS)).size).toBe(3);
  });
});
