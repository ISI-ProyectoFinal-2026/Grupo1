import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { sanctionClock } from "../../src/services/account-sanctions/clock";
import * as mailModule from "../../src/services/mail";
import { createE2EContext, E2EUser, promoteTo } from "./helpers/factories";

type Severity = "mild" | "moderate" | "severe";

describe("E2E: cola admin de sanciones", () => {
  const ctx = createE2EContext("admin-sanctions-queue");
  const auth = (user: E2EUser) => ({ Authorization: `Bearer ${user.token}` });
  const T0 = new Date("2026-03-10T12:00:00.000Z");
  const QUEUE = "/api/admin/account-sanctions/pending";

  let reporters: E2EUser[];
  let admin: E2EUser;

  const fileReports = async (target: E2EUser, severities: Severity[]) => {
    for (const [i, severity] of severities.entries()) {
      const res = await request(app)
        .post("/api/account-reports")
        .set(auth(reporters[i]))
        .send({ reportedUserId: target.id, severity });
      expect(res.status).toBe(201);
    }
  };
  const queueItemOf = async (userId: number) => {
    const res = await request(app).get(QUEUE).set(auth(admin));
    expect(res.status).toBe(200);
    return (res.body.items as { account: { id: number } }[]).find((i) => i.account.id === userId);
  };

  beforeAll(async () => {
    reporters = [];
    for (let i = 0; i < 5; i++) reporters.push(await ctx.registerAndLogin(`reporter-${i}`));
    admin = await ctx.registerAndLogin("admin");
    await promoteTo(admin.id, "admin");
  }, 90_000);

  beforeEach(() => {
    jest.spyOn(sanctionClock, "now").mockReturnValue(T0);
    jest.spyOn(mailModule, "getMailSender").mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await prisma.$disconnect();
  });

  test("el admin ve el caso severo con cuenta, tipo, estado, conteos y fechas, sin denunciantes ni ids de denuncias", async () => {
    const target = await ctx.registerAndLogin("severe");
    await fileReports(target, ["severe", "severe", "severe", "mild", "mild"]);

    const item = await queueItemOf(target.id);

    expect(item).toBeDefined();
    expect(Object.keys(item!).sort()).toEqual(
      ["account", "id", "kind", "reportDates", "role", "severity", "severityCounts", "status"]
    );
    expect(item).toMatchObject({
      account: { id: target.id },
      role: "usuario_regular",
      kind: "provisional",
      status: "active",
      severity: "severe",
      severityCounts: { mild: 2, moderate: 0, severe: 3 },
    });
    expect(item).toHaveProperty("reportDates");
    expect((item as unknown as { reportDates: string[] }).reportDates).toHaveLength(5);
    expect(JSON.stringify(item)).not.toMatch(/reporter|reportId|triggering/i);
    for (const reporter of reporters) expect(JSON.stringify(item)).not.toContain(reporter.email);
  });

  test("incluye el caso de un moderador en pending_review", async () => {
    const staff = await ctx.registerAndLogin("staff");
    await promoteTo(staff.id, "moderador");
    await fileReports(staff, ["moderate", "moderate", "moderate", "mild", "mild"]);

    const item = await queueItemOf(staff.id);

    expect(item).toMatchObject({
      role: "moderador",
      kind: "temporary",
      status: "pending_review",
      severity: "moderate",
      severityCounts: { mild: 2, moderate: 3, severe: 0 },
    });
  });

  test("no incluye las suspensiones temporales de usuarios regulares", async () => {
    const target = await ctx.registerAndLogin("mild");
    await fileReports(target, ["mild", "mild", "mild", "mild", "mild"]);

    expect((await prisma.accountSanction.findFirstOrThrow({ where: { userId: target.id } })).status).toBe("active");
    expect(await queueItemOf(target.id)).toBeUndefined();
  });

  test("un moderador recibe 403 y sin token 401", async () => {
    const moderator = await ctx.registerAndLogin("moderator");
    await promoteTo(moderator.id, "moderador");

    expect((await request(app).get(QUEUE).set(auth(moderator))).status).toBe(403);
    expect((await request(app).get(QUEUE)).status).toBe(401);
  });
});
