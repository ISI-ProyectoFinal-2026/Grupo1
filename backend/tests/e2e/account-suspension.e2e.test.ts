import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { sanctionClock } from "../../src/services/account-sanctions/clock";
import * as mailModule from "../../src/services/mail";
import { codeFor, seedTwoFactor } from "../helpers/two-factor";
import { createE2EContext, E2E_PASSWORD, E2EUser, promoteTo } from "./helpers/factories";

type Severity = "mild" | "moderate" | "severe";

describe("E2E: enforcement y aviso de suspensión", () => {
  const ctx = createE2EContext("account-suspension");
  const auth = (user: E2EUser) => ({ Authorization: `Bearer ${user.token}` });
  const T0 = new Date("2026-03-10T12:00:00.000Z");
  const send = jest.fn();

  let reporters: E2EUser[];

  const login = (email: string, password = E2E_PASSWORD) => request(app).post("/api/auth/login").send({ email, password });
  const report = (reporter: E2EUser, target: E2EUser, severity: Severity) =>
    request(app).post("/api/account-reports").set(auth(reporter)).send({ reportedUserId: target.id, severity });
  const suspendViaReports = async (target: E2EUser, severities: Severity[]) => {
    for (const [i, severity] of severities.entries()) expect((await report(reporters[i], target, severity)).status).toBe(201);
  };
  const suspensionMails = () => send.mock.calls.map(([m]) => m).filter((m) => m.subject === "Tu cuenta de PATITAS fue suspendida");
  const FIVE_MILD: Severity[] = ["mild", "mild", "mild", "mild", "mild"];

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

  test("login con la contraseña correcta devuelve 403 ACCOUNT_SUSPENDED con el detalle y sin reporteros", async () => {
    const target = await ctx.registerAndLogin("login-mod");
    await suspendViaReports(target, ["mild", "mild", "moderate", "moderate", "moderate"]);

    const res = await login(target.email);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
    expect(res.body.token).toBeUndefined();
    expect(res.body.error.details).toEqual({
      type: "temporary",
      severity: "moderate",
      endsAt: "2026-04-10T12:00:00.000Z",
      warning: true,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/reporter|reportIds|triggering/i);
  });

  test("login con contraseña incorrecta sigue dando 401", async () => {
    const target = await ctx.registerAndLogin("login-wrong");
    await suspendViaReports(target, FIVE_MILD);

    const res = await login(target.email, "Incorrecta123");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBeUndefined();
  });

  test("el token viejo es rechazado con la API", async () => {
    const target = await ctx.registerAndLogin("api-old");
    await suspendViaReports(target, FIVE_MILD);

    const res = await request(app).get("/api/auth/me").set(auth(target));

    expect(res.status).toBe(401);
  });

  test("un token vigente de una cuenta con suspensión activa recibe 403 ACCOUNT_SUSPENDED", async () => {
    const target = await ctx.registerAndLogin("api-live");
    await prisma.accountSanction.create({
      data: {
        userId: target.id,
        severity: "severe",
        kind: "provisional",
        status: "active",
        reason: "x",
        triggeringReportIds: [],
        startsAt: T0,
      },
    });

    const res = await request(app).get("/api/auth/me").set(auth(target));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });

  test("el segundo factor no entrega token a una cuenta suspendida", async () => {
    const target = await ctx.registerAndLogin("twofa");
    const { secret } = await seedTwoFactor(target.id);
    const first = await login(target.email);
    expect(first.body.twoFactorRequired).toBe(true);
    await suspendViaReports(target, FIVE_MILD);

    const res = await request(app)
      .post("/api/auth/2fa/login")
      .send({ twoFactorToken: first.body.twoFactorToken, code: codeFor(secret) });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
    expect(res.body.token).toBeUndefined();
  });

  test("al pasar endsAt vuelve a entrar y el token viejo sigue muerto", async () => {
    const target = await ctx.registerAndLogin("expiry");
    await suspendViaReports(target, FIVE_MILD);
    expect((await login(target.email)).status).toBe(403);

    jest.spyOn(sanctionClock, "now").mockReturnValue(new Date("2026-03-24T12:00:00.000Z"));
    const res = await login(target.email);

    expect(res.status).toBe(200);
    expect((await request(app).get("/api/auth/me").set(auth(target))).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set({ Authorization: `Bearer ${res.body.token}` })).status).toBe(200);
  });

  test("una cuenta en pending_review (staff) sigue entrando", async () => {
    const staff = await ctx.registerAndLogin("staff");
    await promoteTo(staff.id, "moderador" as Role);
    await suspendViaReports(staff, FIVE_MILD);

    expect((await prisma.accountSanction.findFirstOrThrow({ where: { userId: staff.id } })).status).toBe("pending_review");
    expect((await login(staff.email)).status).toBe(200);
  });

  test("manda un solo mail al sancionar, sin ids de denunciantes", async () => {
    const target = await ctx.registerAndLogin("mail-once");
    await suspendViaReports(target, FIVE_MILD);

    expect(suspensionMails()).toHaveLength(1);
    const message = suspensionMails()[0];
    expect(message.to).toBe(target.email);
    expect(message.text).toContain("24 de marzo de 2026");
    expect(JSON.stringify(message)).not.toMatch(/reporter|denunciante/i);
  });

  test("el mail de gravedad media advierte que nuevas denuncias pueden eliminar la cuenta", async () => {
    const target = await ctx.registerAndLogin("mail-moderate");
    await suspendViaReports(target, ["moderate", "moderate", "moderate", "moderate", "moderate"]);

    expect(suspensionMails()[0].text).toContain("eliminada de forma definitiva");
  });

  test("si el mail falla, la sanción igual queda y la denuncia responde 201", async () => {
    send.mockRejectedValue(new Error("smtp caído"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const target = await ctx.registerAndLogin("mail-fail");

    await suspendViaReports(target, FIVE_MILD);

    expect(await prisma.accountSanction.count({ where: { userId: target.id, status: "active" } })).toBe(1);
  });

  test("no manda mail al vencer la suspensión", async () => {
    const target = await ctx.registerAndLogin("mail-expiry");
    await suspendViaReports(target, FIVE_MILD);
    send.mockClear();
    jest.spyOn(sanctionClock, "now").mockReturnValue(new Date("2026-04-01T00:00:00.000Z"));
    await login(target.email);

    expect(send).not.toHaveBeenCalled();
  });
});
