import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as accountSanctionsService from "../../src/services/account-sanctions.service";
import { createE2EContext, E2EUser, promoteTo } from "./helpers/factories";

/**
 * Journey de #267: cinco personas distintas denuncian una cuenta, una intenta
 * repetir, y al llegar al umbral se calcula la gravedad que aplica la sanción
 * (#38). Moderación ve la cuenta con su gravedad resultante.
 */
describe("E2E: denuncia de cuentas con gravedad", () => {
  const ctx = createE2EContext("account-reports");
  const auth = (user: E2EUser) => ({ Authorization: `Bearer ${user.token}` });

  let reported: E2EUser;
  let reporters: E2EUser[];
  let moderator: E2EUser;
  let thresholdSpy: jest.SpyInstance;

  beforeAll(async () => {
    reported = await ctx.registerAndLogin("reported");
    reporters = [];
    for (let i = 0; i < 5; i++) reporters.push(await ctx.registerAndLogin(`reporter-${i}`));
    moderator = await ctx.registerAndLogin("moderator");
    await promoteTo(moderator.id, "moderador");
    thresholdSpy = jest.spyOn(accountSanctionsService, "onAccountReportThreshold").mockResolvedValue(undefined);
  }, 60_000);

  afterAll(async () => {
    jest.restoreAllMocks();
    await ctx.cleanup();
    await prisma.$disconnect();
  });

  test("cuatro denuncias quedan registradas sin disparar la sanción", async () => {
    for (const [i, severity] of (["moderate", "severe", "moderate", "severe"] as const).entries()) {
      const res = await request(app)
        .post("/api/account-reports")
        .set(auth(reporters[i]))
        .send({ reportedUserId: reported.id, severity });
      expect(res.status).toBe(201);
    }
    expect(thresholdSpy).not.toHaveBeenCalled();
  });

  test("quien ya denunció no puede volver a hacerlo", async () => {
    const res = await request(app)
      .post("/api/account-reports")
      .set(auth(reporters[0]))
      .send({ reportedUserId: reported.id, severity: "mild" });
    expect(res.status).toBe(409);
  });

  test("la quinta persona dispara la sanción con la gravedad más alta del empate", async () => {
    const res = await request(app)
      .post("/api/account-reports")
      .set(auth(reporters[4]))
      .send({ reportedUserId: reported.id, severity: "mild" });

    expect(res.status).toBe(201);
    expect(thresholdSpy).toHaveBeenCalledTimes(1);
    expect(thresholdSpy).toHaveBeenCalledWith(reported.id, "severe");
  });

  test("moderación ve la cuenta con sus denuncias y la gravedad resultante", async () => {
    const res = await request(app).get("/api/account-reports").set(auth(moderator));

    expect(res.status).toBe(200);
    const entry = res.body.find((e: { reportedUser: { id: number } }) => e.reportedUser.id === reported.id);
    expect(entry).toMatchObject({
      reportCount: 5,
      severityCounts: { mild: 1, moderate: 2, severe: 2 },
      thresholdReached: true,
      resultingSeverity: "severe",
    });
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
