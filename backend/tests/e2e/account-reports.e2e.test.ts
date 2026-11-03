import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as accountSanctionsService from "../../src/services/account-sanctions.service";
import { sanctionClock } from "../../src/services/account-sanctions/clock";
import { createE2EContext, E2EUser, promoteTo } from "./helpers/factories";

type Severity = "mild" | "moderate" | "severe";

/**
 * Journey de #267 + #38 (núcleo): cinco personas distintas denuncian una cuenta
 * en un ciclo; a la quinta se crea la sanción en la misma transacción.
 */
describe("E2E: denuncias por ciclo y sanción", () => {
  const ctx = createE2EContext("account-reports");
  const auth = (user: E2EUser) => ({ Authorization: `Bearer ${user.token}` });
  const T0 = new Date("2026-03-10T12:00:00.000Z");

  let reporters: E2EUser[];
  let sacrificial: E2EUser;
  let moderator: E2EUser;

  const newTarget = async (label: string, role?: Role) => {
    const user = await ctx.registerAndLogin(label);
    if (role) await promoteTo(user.id, role);
    return user;
  };
  const report = (reporter: E2EUser, target: E2EUser, severity: Severity) =>
    request(app).post("/api/account-reports").set(auth(reporter)).send({ reportedUserId: target.id, severity });
  const reportWith = async (target: E2EUser, severities: Severity[], who: E2EUser[] = reporters) => {
    for (const [i, severity] of severities.entries()) expect((await report(who[i], target, severity)).status).toBe(201);
  };
  const sanctionsOf = (target: E2EUser) =>
    prisma.accountSanction.findMany({ where: { userId: target.id }, orderBy: { id: "asc" } });

  beforeAll(async () => {
    reporters = [];
    for (let i = 0; i < 6; i++) reporters.push(await ctx.registerAndLogin(`reporter-${i}`));
    sacrificial = await ctx.registerAndLogin("sacrificial");
    moderator = await ctx.registerAndLogin("moderator");
    await promoteTo(moderator.id, "moderador");
  }, 90_000);

  beforeEach(() => {
    jest.spyOn(sanctionClock, "now").mockReturnValue(T0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await prisma.$disconnect();
  });

  test("con cuatro denuncias no hay sanción y repetir en el mismo ciclo da 409", async () => {
    const target = await newTarget("four");
    await reportWith(target, ["severe", "severe", "severe", "severe"]);

    expect((await report(reporters[0], target, "mild")).status).toBe(409);
    expect(await sanctionsOf(target)).toHaveLength(0);
  });

  test("no se puede denunciar la propia cuenta", async () => {
    expect((await report(reporters[0], reporters[0], "mild")).status).toBe(403);
  });

  test.each([
    ["leve", ["mild", "mild", "mild", "moderate", "moderate"], "mild", "temporary", false, "2026-03-24T12:00:00.000Z"],
    ["moderada", ["mild", "mild", "moderate", "moderate", "severe"], "moderate", "temporary", true, "2026-04-10T12:00:00.000Z"],
    ["grave", ["mild", "mild", "severe", "severe", "moderate"], "severe", "provisional", false, null],
  ] as const)("la quinta denuncia %s crea la sanción del ciclo", async (_label, severities, severity, kind, warning, endsAt) => {
    const target = await newTarget("threshold");
    const before = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    await reportWith(target, [...severities]);

    const [sanction] = await sanctionsOf(target);
    expect(sanction).toMatchObject({ severity, kind, status: "active", warning, startsAt: T0 });
    expect(sanction.endsAt?.toISOString() ?? null).toBe(endsAt);
    expect(sanction.reason).not.toBe("");

    const reports = await prisma.accountReport.findMany({ where: { reportedUserId: target.id } });
    expect(reports.every((r) => r.sanctionId === sanction.id)).toBe(true);
    expect([...sanction.triggeringReportIds].sort()).toEqual(reports.map((r) => r.id).sort());

    const events = await prisma.accountSanctionEvent.findMany({ where: { sanctionId: sanction.id } });
    expect(events).toEqual([expect.objectContaining({ type: "created", actorId: null })]);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(after.tokenVersion).toBe(before.tokenVersion + 1);
  });

  test("una cuenta suspendida rechaza nuevas denuncias sin guardarlas", async () => {
    const target = await newTarget("suspended");
    await reportWith(target, ["mild", "mild", "mild", "mild", "mild"]);

    const res = await report(reporters[5], target, "mild");

    expect(res.status).toBe(409);
    expect(await prisma.accountReport.count({ where: { reportedUserId: target.id } })).toBe(5);
    expect(await sanctionsOf(target)).toHaveLength(1);
  });

  test("al vencer la suspensión se puede volver a denunciar y solo cuenta el ciclo nuevo", async () => {
    const target = await newTarget("relift");
    await reportWith(target, ["mild", "mild", "mild", "mild", "mild"]);
    jest.spyOn(sanctionClock, "now").mockReturnValue(new Date("2026-03-25T00:00:00.000Z"));

    expect((await report(reporters[0], target, "mild")).status).toBe(201);

    const [sanction] = await sanctionsOf(target);
    expect(sanction.status).toBe("expired");
    const events = await prisma.accountSanctionEvent.findMany({ where: { sanctionId: sanction.id }, orderBy: { id: "asc" } });
    expect(events.map((e) => [e.type, e.actorId, e.reason])).toEqual([
      ["created", null, null],
      ["expired", null, "expiry"],
    ]);
    expect(await prisma.accountReport.count({ where: { reportedUserId: target.id, sanctionId: null } })).toBe(1);
    expect(await sanctionsOf(target)).toHaveLength(1);
  });

  test("reincidencia: con una moderada previa el nuevo umbral es permanente", async () => {
    const target = await newTarget("recidivist");
    await reportWith(target, ["moderate", "moderate", "moderate", "moderate", "moderate"]);
    jest.spyOn(sanctionClock, "now").mockReturnValue(new Date("2026-04-11T00:00:00.000Z"));

    await reportWith(target, ["mild", "mild", "mild", "mild", "mild"]);

    const sanctions = await sanctionsOf(target);
    expect(sanctions.map((s) => [s.status, s.kind])).toEqual([
      ["expired", "temporary"],
      ["active", "permanent"],
    ]);
    expect(sanctions[1].endsAt).toBeNull();
  });

  test("moderador/admin en el umbral queda en revisión: no se suspende y rechaza nuevas denuncias", async () => {
    const staff = await newTarget("staff", "moderador");
    const before = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    await reportWith(staff, ["moderate", "moderate", "moderate", "mild", "severe"]);

    const [sanction] = await sanctionsOf(staff);
    expect(sanction).toMatchObject({ status: "pending_review", kind: "temporary", severity: "moderate", warning: true, endsAt: null });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(after).toMatchObject({ role: "moderador", tokenVersion: before.tokenVersion });
    expect((await report(reporters[5], staff, "mild")).status).toBe(409);
  });

  test("dos quintas denuncias simultáneas generan una sola sanción", async () => {
    const target = await newTarget("concurrent");
    await reportWith(target, ["moderate", "moderate", "moderate", "moderate"]);

    const results = await Promise.all([4, 5].map((i) => report(reporters[i], target, "moderate")));

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await sanctionsOf(target)).toHaveLength(1);
  });

  test("si falla crear la sanción, la quinta denuncia no queda guardada", async () => {
    const target = await newTarget("rollback");
    await reportWith(target, ["mild", "mild", "mild", "mild"]);
    jest.spyOn(accountSanctionsService, "createFromThreshold").mockRejectedValue(new Error("boom"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await report(reporters[4], target, "mild");

    expect(res.status).toBe(500);
    expect(await prisma.accountReport.count({ where: { reportedUserId: target.id } })).toBe(4);
    expect(await sanctionsOf(target)).toHaveLength(0);
  });

  test("borrar a un denunciante no deshace ni duplica la sanción ya creada", async () => {
    const target = await newTarget("deleted-reporter");
    await reportWith(target, ["mild", "mild", "mild", "mild", "mild"], [...reporters.slice(0, 4), sacrificial]);
    await prisma.user.delete({ where: { id: sacrificial.id } });

    const sanctions = await sanctionsOf(target);
    expect(sanctions).toHaveLength(1);
    expect(sanctions[0].triggeringReportIds).toHaveLength(5);
  });

  test("moderación lista las denuncias del ciclo abierto", async () => {
    const target = await newTarget("list");
    await reportWith(target, ["mild", "severe"]);

    const res = await request(app).get("/api/account-reports").set(auth(moderator));

    const entry = res.body.find((e: { reportedUser: { id: number } }) => e.reportedUser.id === target.id);
    expect(entry).toMatchObject({ reportCount: 2, severityCounts: { mild: 1, moderate: 0, severe: 1 }, thresholdReached: false });
  });

  test("tras la sanción las denuncias cerradas ya no figuran en el ciclo abierto", async () => {
    const target = await newTarget("list-closed");
    await reportWith(target, ["mild", "mild", "mild", "mild", "mild"]);

    const res = await request(app).get("/api/account-reports").set(auth(moderator));

    expect(res.body.some((e: { reportedUser: { id: number } }) => e.reportedUser.id === target.id)).toBe(false);
  });
});

describe("E2E: cleanup con sanciones", () => {
  const ctx = createE2EContext("account-sanctions-cleanup");

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("cleanupE2EData borra eventos, denuncias y sanciones antes que los usuarios", async () => {
    const target = await ctx.registerAndLogin("target");
    const reporter = await ctx.registerAndLogin("reporter");
    const admin = await ctx.registerAndLogin("admin");

    const report = await prisma.accountReport.create({
      data: { reportedUserId: target.id, reporterId: reporter.id, severity: "mild" },
    });
    const sanction = await prisma.accountSanction.create({
      data: {
        userId: target.id,
        severity: "mild",
        kind: "temporary",
        status: "active",
        reason: "fixed",
        triggeringReportIds: [report.id],
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 1000),
      },
    });
    await prisma.accountReport.update({ where: { id: report.id }, data: { sanctionId: sanction.id } });
    await prisma.accountSanctionEvent.create({ data: { sanctionId: sanction.id, actorId: admin.id, type: "created" } });

    await ctx.cleanup();

    expect(await prisma.accountSanctionEvent.count({ where: { sanctionId: sanction.id } })).toBe(0);
    expect(await prisma.accountSanction.count({ where: { userId: target.id } })).toBe(0);
    expect(await prisma.accountReport.count({ where: { id: report.id } })).toBe(0);
    expect(await prisma.user.count({ where: { id: { in: [target.id, reporter.id, admin.id] } } })).toBe(0);
  }, 60_000);
});
