import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as adminsModule from "../../src/services/account-sanctions/admins";
import * as mailService from "../../src/services/mail.service";
import * as chatSocket from "../../src/sockets/chat.socket";
import { codeFor, seedTwoFactor, wrongCodeFor } from "../helpers/two-factor";
import { createTestUser } from "../helpers/users";

const PASSWORD = "Password123";

// DELETE /api/auth/me (#366)
describe("DELETE /api/auth/me", () => {
  const userIds: number[] = [];
  let deletedMail: jest.SpyInstance;
  let disconnectSockets: jest.Mock;
  let roomOf: jest.Mock;

  beforeEach(() => {
    deletedMail = jest.spyOn(mailService, "sendAccountDeleted").mockResolvedValue();
    disconnectSockets = jest.fn();
    roomOf = jest.fn().mockReturnValue({ disconnectSockets });
    jest.spyOn(chatSocket, "getChatIO").mockReturnValue({ in: roomOf } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function newUser(prefix: string, role?: "admin" | "moderador") {
    const created = await createTestUser({ prefix, password: PASSWORD, role });
    userIds.push(created.user.id);
    return created;
  }

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const del = (token: string, body: object) => request(app).delete("/api/auth/me").set(bearer(token)).send(body);
  const exists = async (id: number) => (await prisma.user.count({ where: { id } })) === 1;

  function expectNoEffects() {
    expect(deletedMail).not.toHaveBeenCalled();
    expect(disconnectSockets).not.toHaveBeenCalled();
  }

  async function openSanction(userId: number, status: "pending_review" | "active") {
    await prisma.accountSanction.create({
      data: { userId, severity: "severe", kind: "provisional", status, reason: "x", triggeringReportIds: [], startsAt: new Date() },
    });
  }

  async function premiumBusiness(userId: number, planExpiresAt: Date) {
    await prisma.business.create({
      data: {
        userId,
        name: "Veterinaria",
        cuit: `20-${Date.now().toString().slice(-8)}-${userId % 10}`,
        address: "Calle 1",
        phone: "123",
        category: "VETERINARIA",
        plan: "PREMIUM",
        planExpiresAt,
      },
    });
  }

  describe("entrada y reautenticación", () => {
    test("sin token responde 401", async () => {
      expect((await request(app).delete("/api/auth/me").send({ password: PASSWORD })).status).toBe(401);
    });

    test.each([
      ["sin contraseña", {}],
      ["contraseña vacía", { password: "" }],
      ["campo extra", { password: PASSWORD, role: "admin" }],
    ])("%s responde 400 y no borra", async (_case, body) => {
      const { user, token } = await newUser("delete-invalid");

      const res = await del(token, body);

      expect(res.status).toBe(400);
      expect(await exists(user.id)).toBe(true);
      expectNoEffects();
    });

    test("contraseña incorrecta responde 403 INVALID_PASSWORD y no borra", async () => {
      const { user, token } = await newUser("delete-wrong-password");

      const res = await del(token, { password: "otra-clave" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("INVALID_PASSWORD");
      expect(await exists(user.id)).toBe(true);
      expectNoEffects();
    });

    test("el token de otro usuario borra solo a ese otro usuario, no al dueño de la contraseña", async () => {
      const { user: victim } = await newUser("delete-victim");
      const { token: attackerToken } = await newUser("delete-attacker");

      const res = await del(attackerToken, { password: "clave-de-la-victima" });

      expect(res.status).toBe(403);
      expect(await exists(victim.id)).toBe(true);
    });

    test("con 2FA activo y sin código responde 400 TWO_FACTOR_CODE_REQUIRED", async () => {
      const { user, token } = await newUser("delete-2fa-missing");
      await seedTwoFactor(user.id);

      const res = await del(token, { password: PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("TWO_FACTOR_CODE_REQUIRED");
      expect(await exists(user.id)).toBe(true);
      expectNoEffects();
    });

    test("con 2FA activo y código inválido responde 400 INVALID_TWO_FACTOR_CODE y suma un fallo", async () => {
      const { user, token } = await newUser("delete-2fa-invalid");
      const { secret } = await seedTwoFactor(user.id);

      const res = await del(token, { password: PASSWORD, code: wrongCodeFor(secret) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_TWO_FACTOR_CODE");
      expect(await exists(user.id)).toBe(true);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).twoFactorFailedAttempts).toBe(1);
      expectNoEffects();
    });
  });

  describe("bloqueos 409", () => {
    test("con una sanción en revisión responde 409 ACCOUNT_SANCTION_OPEN", async () => {
      const { user, token } = await newUser("delete-sanction");
      await openSanction(user.id, "pending_review");

      const res = await del(token, { password: PASSWORD });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ACCOUNT_SANCTION_OPEN");
      expect(await exists(user.id)).toBe(true);
      expectNoEffects();
    });

    test("con una suspensión vigente la sesión ya queda rechazada por requireAuth", async () => {
      const { user, token } = await newUser("delete-suspended");
      await openSanction(user.id, "active");

      const res = await del(token, { password: PASSWORD });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
      expect(await exists(user.id)).toBe(true);
    });

    test("el último administrador responde 409 LAST_ADMIN", async () => {
      const { user, token } = await newUser("delete-last-admin", "admin");
      jest.spyOn(adminsModule, "countOtherActiveAdmins").mockResolvedValue(0);

      const res = await del(token, { password: PASSWORD });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("LAST_ADMIN");
      expect(await exists(user.id)).toBe(true);
      expectNoEffects();
    });

    test("un administrador con otro admin activo puede darse de baja", async () => {
      const { user, token } = await newUser("delete-admin", "admin");
      jest.spyOn(adminsModule, "countOtherActiveAdmins").mockResolvedValue(1);

      expect((await del(token, { password: PASSWORD })).status).toBe(204);
      expect(await exists(user.id)).toBe(false);
    });

    test("con un comercio Premium vigente responde 409 ACTIVE_PREMIUM_BUSINESS", async () => {
      const { user, token } = await newUser("delete-premium");
      await premiumBusiness(user.id, new Date(Date.now() + 86_400_000));

      const res = await del(token, { password: PASSWORD });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ACTIVE_PREMIUM_BUSINESS");
      expect(await exists(user.id)).toBe(true);
      expectNoEffects();
    });

    test("con el Premium vencido se borra la cuenta y el comercio", async () => {
      const { user, token } = await newUser("delete-premium-expired");
      await premiumBusiness(user.id, new Date(Date.now() - 86_400_000));

      expect((await del(token, { password: PASSWORD })).status).toBe(204);
      expect(await exists(user.id)).toBe(false);
      expect(await prisma.business.count({ where: { userId: user.id } })).toBe(0);
    });

    test("un 409 con 2FA no gasta el código ni suma fallos", async () => {
      const { user, token } = await newUser("delete-2fa-409");
      const { secret } = await seedTwoFactor(user.id);
      await openSanction(user.id, "pending_review");

      const res = await del(token, { password: PASSWORD, code: codeFor(secret) });

      expect(res.status).toBe(409);
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored).toMatchObject({ twoFactorLastStep: null, twoFactorFailedAttempts: 0 });
    });
  });

  describe("baja", () => {
    test("sin 2FA: borra la cuenta, conserva sus denuncias sin autor y aplica los efectos", async () => {
      const { user, token } = await newUser("delete-ok");
      const { user: other } = await newUser("delete-ok-other");
      const made = await prisma.accountReport.create({ data: { reporterId: user.id, reportedUserId: other.id, severity: "mild" } });
      const report = await prisma.report.create({ data: { userId: user.id, reportType: "lost", title: "Perdido" } });

      const res = await del(token, { password: PASSWORD });

      expect(res.status).toBe(204);
      expect(await exists(user.id)).toBe(false);
      expect(await prisma.report.count({ where: { id: report.id } })).toBe(0);
      expect(await prisma.accountReport.findUniqueOrThrow({ where: { id: made.id } })).toMatchObject({
        reporterId: null,
        reportedUserId: other.id,
      });
      expect(roomOf).toHaveBeenCalledWith(chatSocket.userRoom(user.id));
      expect(disconnectSockets).toHaveBeenCalledWith(true);
      expect(deletedMail).toHaveBeenCalledWith(user.email);

      // la sesión vieja deja de valer
      expect((await request(app).get("/api/auth/me").set(bearer(token))).status).toBe(401);
    });

    test("con 2FA y TOTP válido borra la cuenta", async () => {
      const { user, token } = await newUser("delete-2fa-ok");
      const { secret } = await seedTwoFactor(user.id);

      const res = await del(token, { password: PASSWORD, code: codeFor(secret) });

      expect(res.status).toBe(204);
      expect(await exists(user.id)).toBe(false);
      expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } })).toBe(0);
      expect(deletedMail).toHaveBeenCalledWith(user.email);
    });

    test("con 2FA acepta un código de recuperación", async () => {
      const { user, token } = await newUser("delete-2fa-recovery");
      const { recoveryCodes } = await seedTwoFactor(user.id);

      expect((await del(token, { password: PASSWORD, code: recoveryCodes[0] })).status).toBe(204);
      expect(await exists(user.id)).toBe(false);
    });
  });
});
