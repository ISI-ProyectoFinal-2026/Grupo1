import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { sanctionClock } from "../../src/services/account-sanctions/clock";
import { expireDueSanctions } from "../../src/services/account-sanctions/sweep";
import * as mailModule from "../../src/services/mail";
import { createE2EContext, E2EUser } from "./helpers/factories";

describe("E2E: barrido de vencimiento de suspensiones", () => {
  const ctx = createE2EContext("sanction-expiry");
  const auth = (user: E2EUser) => ({ Authorization: `Bearer ${user.token}` });
  // reloj en 2020: el barrido global no debe vencer sanciones de otras suites
  const T0 = new Date("2020-01-10T12:00:00.000Z");
  const AFTER_MILD = new Date("2020-01-24T12:00:01.000Z");
  const send = jest.fn();

  let reporters: E2EUser[];

  const suspend = async (target: E2EUser, severity: "mild" | "severe") => {
    for (const reporter of reporters) {
      const res = await request(app)
        .post("/api/account-reports")
        .set(auth(reporter))
        .send({ reportedUserId: target.id, severity });
      expect(res.status).toBe(201);
    }
  };
  const sanctionOf = (userId: number) => prisma.accountSanction.findFirstOrThrow({ where: { userId } });
  const eventsOf = (sanctionId: number) => prisma.accountSanctionEvent.findMany({ where: { sanctionId }, orderBy: { id: "asc" } });

  beforeAll(async () => {
    reporters = [];
    for (let i = 0; i < 5; i++) reporters.push(await ctx.registerAndLogin(`reporter-${i}`));
  }, 90_000);

  beforeEach(() => {
    send.mockReset().mockResolvedValue(undefined);
    jest.spyOn(sanctionClock, "now").mockReturnValue(T0);
    jest.spyOn(mailModule, "getMailSender").mockReturnValue({ send });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await prisma.$disconnect();
  });

  test("al vencer endsAt pasa a expired con evento del sistema (motivo expiry) y sin mail", async () => {
    const target = await ctx.registerAndLogin("mild");
    await suspend(target, "mild");
    send.mockClear();

    const lifted = await expireDueSanctions(AFTER_MILD);

    expect(lifted).toBeGreaterThanOrEqual(1);
    const sanction = await sanctionOf(target.id);
    expect(sanction.status).toBe("expired");
    const events = await eventsOf(sanction.id);
    expect(events.map((e) => e.type)).toEqual(["created", "expired"]);
    expect(events[1]).toMatchObject({ actorId: null, reason: "expiry" });
    expect(send).not.toHaveBeenCalled();
  });

  test("es idempotente: una segunda corrida no agrega eventos", async () => {
    const target = await ctx.registerAndLogin("idem");
    await suspend(target, "mild");
    await expireDueSanctions(AFTER_MILD);
    const sanction = await sanctionOf(target.id);

    await expireDueSanctions(AFTER_MILD);

    expect(await eventsOf(sanction.id)).toHaveLength(2);
  });

  test("no toca las suspensiones que todavía no vencieron ni las provisionales", async () => {
    const early = await ctx.registerAndLogin("early");
    const severe = await ctx.registerAndLogin("severe");
    await suspend(early, "mild");
    await suspend(severe, "severe");

    await expireDueSanctions(new Date("2020-01-20T00:00:00.000Z"));
    await expireDueSanctions(AFTER_MILD);

    expect((await sanctionOf(early.id)).status).toBe("expired");
    const provisional = await sanctionOf(severe.id);
    expect(provisional.status).toBe("active");
    expect(await eventsOf(provisional.id)).toHaveLength(1);
  });
});
