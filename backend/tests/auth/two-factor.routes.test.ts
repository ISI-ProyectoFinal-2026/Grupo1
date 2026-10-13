import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as mailService from "../../src/services/mail.service";
import { decryptSecret } from "../../src/services/two-factor/crypto";
import { buildOtpauthUri, currentStep } from "../../src/services/two-factor/totp";
import { twoFactorClock } from "../../src/services/two-factor/clock";
import { hashRecoveryCode } from "../../src/services/two-factor/verify";
import { issueAuthToken } from "../../src/services/auth-tokens.service";
import { codeFor, seedTwoFactor, wrongCodeFor } from "../helpers/two-factor";
import { createTestUser } from "../helpers/users";

const PASSWORD = "Password123";
const RESET_WAIT_MS = 72 * 60 * 60 * 1000;
const RECOVERY_FORMAT = /^[A-Z2-7]{5}-[A-Z2-7]{5}$/;

describe("administración de 2FA", () => {
  const userIds: number[] = [];
  let enabledNotice: jest.SpyInstance;
  let disabledNotice: jest.SpyInstance;

  beforeEach(() => {
    enabledNotice = jest.spyOn(mailService, "sendTwoFactorEnabled").mockResolvedValue();
    disabledNotice = jest.spyOn(mailService, "sendTwoFactorDisabled").mockResolvedValue();
    jest.spyOn(mailService, "sendTwoFactorRecoveryCodeUsed").mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function newUser(prefix: string, options: { verified?: boolean } = {}) {
    const created = await createTestUser({ prefix, password: PASSWORD, ...options });
    userIds.push(created.user.id);
    return created;
  }

  /** Usuario con 2FA ya activo directo en la base. */
  async function enabledUser(prefix: string, seed: Parameters<typeof seedTwoFactor>[1] = {}) {
    const created = await newUser(prefix);
    const seeded = await seedTwoFactor(created.user.id, seed);
    return { ...created, ...seeded };
  }

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const post = (path: string, token: string, body: object = {}) =>
    request(app).post(`/api/auth/2fa/${path}`).set(bearer(token)).send(body);
  const dbUser = (id: number) => prisma.user.findUniqueOrThrow({ where: { id } });
  const meStatus = async (token: string) => (await request(app).get("/api/auth/me").set(bearer(token))).status;

  async function challengeFor(email: string): Promise<string> {
    const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
    return res.body.twoFactorToken as string;
  }

  describe("sin sesión", () => {
    test.each([
      ["get", "status"],
      ["post", "setup"],
      ["post", "enable"],
      ["post", "disable"],
      ["post", "recovery-codes"],
    ] as const)("%s /2fa/%s responde 401", async (method, path) => {
      const res = await request(app)[method](`/api/auth/2fa/${path}`).send({});

      expect(res.status).toBe(401);
    });

    test("un JWT inválido también es 401", async () => {
      const res = await post("setup", "no-es-un-jwt");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /2fa/setup", () => {
    test("devuelve secreto y URI otpauth, guarda solo el cifrado y no activa el 2FA", async () => {
      const { user, token } = await newUser("tf-setup-ok");

      const res = await post("setup", token);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["otpauthUri", "secret"]);
      expect(res.body.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(res.body.otpauthUri).toBe(buildOtpauthUri(res.body.secret, user.email));

      const stored = await dbUser(user.id);
      expect(stored.twoFactorSecretEnc).not.toBeNull();
      expect(stored.twoFactorSecretEnc).not.toContain(res.body.secret);
      expect(decryptSecret(stored.twoFactorSecretEnc as string, user.id)).toBe(res.body.secret);
      expect(stored.twoFactorEnabledAt).toBeNull();
      expect(stored.tokenVersion).toBe(user.tokenVersion);
    });

    test("no cambia el login: sigue devolviendo la sesión directo", async () => {
      const { user, token } = await newUser("tf-setup-login");
      await post("setup", token);

      const login = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });

      expect(login.status).toBe(200);
      expect(login.body.token).toEqual(expect.any(String));
      expect(login.body).not.toHaveProperty("twoFactorRequired");
      expect(await meStatus(token)).toBe(200);
    });

    test("con el email sin verificar responde 403 EMAIL_NOT_VERIFIED y no guarda nada", async () => {
      const { user, token } = await newUser("tf-setup-unverified", { verified: false });

      const res = await post("setup", token);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
      expect((await dbUser(user.id)).twoFactorSecretEnc).toBeNull();
    });

    test("repetirlo reemplaza el secreto pendiente: el código del anterior ya no confirma", async () => {
      const { token } = await newUser("tf-setup-repeat");
      const first = await post("setup", token);
      const second = await post("setup", token);

      expect(second.body.secret).not.toBe(first.body.secret);

      const stale = await post("enable", token, { code: codeFor(first.body.secret) });
      expect(stale.status).toBe(400);
      const fresh = await post("enable", token, { code: codeFor(second.body.secret) });
      expect(fresh.status).toBe(200);
    });

    test("con el 2FA activo responde 409 TWO_FACTOR_ALREADY_ENABLED y no toca el secreto", async () => {
      const { user, token } = await enabledUser("tf-setup-enabled");
      const before = (await dbUser(user.id)).twoFactorSecretEnc;

      const res = await post("setup", token);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TWO_FACTOR_ALREADY_ENABLED");
      expect((await dbUser(user.id)).twoFactorSecretEnc).toBe(before);
    });
  });

  describe("POST /2fa/enable", () => {
    async function pendingSetup(prefix: string) {
      const created = await newUser(prefix);
      const setup = await post("setup", created.token);
      return { ...created, secret: setup.body.secret as string };
    }

    test("activa el 2FA: JWT nuevo, 10 códigos de recuperación y el JWT viejo muere", async () => {
      const { user, token, secret } = await pendingSetup("tf-enable-ok");

      const res = await post("enable", token, { code: codeFor(secret) });

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["recoveryCodes", "token", "user"]);
      expect(res.body.user.twoFactorEnabled).toBe(true);
      expect(res.body.recoveryCodes).toHaveLength(10);
      expect(new Set(res.body.recoveryCodes).size).toBe(10);
      for (const code of res.body.recoveryCodes) {
        expect(code).toMatch(RECOVERY_FORMAT);
      }

      const stored = await dbUser(user.id);
      expect(stored.twoFactorEnabledAt).not.toBeNull();
      expect(stored.tokenVersion).toBe(user.tokenVersion + 1);
      expect(await meStatus(token)).toBe(401);
      expect(await meStatus(res.body.token)).toBe(200);
    });

    test("guarda los códigos de recuperación solo como hash", async () => {
      const { user, token, secret } = await pendingSetup("tf-enable-hash");

      const res = await post("enable", token, { code: codeFor(secret) });

      const rows = await prisma.twoFactorRecoveryCode.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(10);
      expect(rows.every((row) => row.usedAt === null)).toBe(true);
      expect(rows.map((row) => row.codeHash).sort()).toEqual(
        (res.body.recoveryCodes as string[]).map(hashRecoveryCode).sort()
      );
      expect(JSON.stringify(rows)).not.toContain(res.body.recoveryCodes[0]);
    });

    test("manda un único aviso al email de la cuenta", async () => {
      const { user, token, secret } = await pendingSetup("tf-enable-mail");

      await post("enable", token, { code: codeFor(secret) });

      expect(enabledNotice).toHaveBeenCalledTimes(1);
      expect(enabledNotice).toHaveBeenCalledWith(user.email);
    });

    test("registra el paso aceptado: el mismo código no sirve en el login, uno posterior sí", async () => {
      const { user, token, secret } = await pendingSetup("tf-enable-replay");
      const code = codeFor(secret);
      await post("enable", token, { code });

      expect((await dbUser(user.id)).twoFactorLastStep).toBe(currentStep(twoFactorClock.now()));

      const replay = await request(app)
        .post("/api/auth/2fa/login")
        .send({ twoFactorToken: await challengeFor(user.email), code });
      expect(replay.status).toBe(400);
      expect(replay.body.error.code).toBe("INVALID_TWO_FACTOR_CODE");

      const next = await request(app)
        .post("/api/auth/2fa/login")
        .send({ twoFactorToken: await challengeFor(user.email), code: codeFor(secret, 1) });
      expect(next.status).toBe(200);
    });

    test("un código incorrecto responde 400 sin cambiar nada ni mandar aviso", async () => {
      const { user, token, secret } = await pendingSetup("tf-enable-wrong");

      const res = await post("enable", token, { code: wrongCodeFor(secret) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_TWO_FACTOR_CODE");
      const stored = await dbUser(user.id);
      expect(stored.twoFactorEnabledAt).toBeNull();
      expect(stored.tokenVersion).toBe(user.tokenVersion);
      expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } })).toBe(0);
      expect(enabledNotice).not.toHaveBeenCalled();
    });

    test("seis códigos incorrectos seguidos nunca bloquean y el correcto después todavía sirve", async () => {
      const { user, token, secret } = await pendingSetup("tf-enable-nolock");

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const res = await post("enable", token, { code: wrongCodeFor(secret) });
        expect(res.status).toBe(400);
      }

      const stored = await dbUser(user.id);
      expect(stored.twoFactorFailedAttempts).toBe(0);
      expect(stored.twoFactorLockedUntil).toBeNull();
      expect((await post("enable", token, { code: codeFor(secret) })).status).toBe(200);
    });

    test("no mira el bloqueo ni lo toca: con locked_until a futuro igual confirma", async () => {
      const created = await newUser("tf-enable-ignores-lock");
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      const { secret } = await seedTwoFactor(created.user.id, { enabled: false, failedAttempts: 3, lockedUntil });

      const res = await post("enable", created.token, { code: codeFor(secret) });

      expect(res.status).toBe(200);
      const stored = await dbUser(created.user.id);
      expect(stored.twoFactorFailedAttempts).toBe(3);
      expect(stored.twoFactorLockedUntil?.getTime()).toBe(lockedUntil.getTime());
    });

    test("sin alta previa responde 409 TWO_FACTOR_NOT_SETUP", async () => {
      const { token } = await newUser("tf-enable-nosetup");

      const res = await post("enable", token, { code: "123456" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TWO_FACTOR_NOT_SETUP");
    });

    test("con el 2FA ya activo responde 409 TWO_FACTOR_ALREADY_ENABLED", async () => {
      const { token, secret } = await enabledUser("tf-enable-twice");

      const res = await post("enable", token, { code: codeFor(secret) });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TWO_FACTOR_ALREADY_ENABLED");
    });

    test("con el email sin verificar responde 403", async () => {
      const { token } = await newUser("tf-enable-unverified", { verified: false });

      const res = await post("enable", token, { code: "123456" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
    });

    test("si el aviso falla igual responde 200 y el estado queda guardado", async () => {
      enabledNotice.mockRejectedValue(new Error("smtp caído"));
      jest.spyOn(console, "error").mockImplementation(() => {});
      const { user, token, secret } = await pendingSetup("tf-enable-mailfail");

      const res = await post("enable", token, { code: codeFor(secret) });

      expect(res.status).toBe(200);
      expect((await dbUser(user.id)).twoFactorEnabledAt).not.toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    describe("secreto pendiente que cambia mientras se confirma", () => {
      /**
       * Deja que un /2fa/setup del mismo usuario pise el secreto pendiente justo
       * después de que enable lo leyó y antes de que abra su transacción.
       */
      function rotateSecretBeforeEnableTransaction(token: string) {
        const client = prisma as unknown as { $transaction: (...args: unknown[]) => Promise<unknown> };
        const original = client.$transaction.bind(prisma);
        const rotated: { secret?: string } = {};
        jest.spyOn(client, "$transaction").mockImplementationOnce(async (...args: unknown[]) => {
          rotated.secret = (await post("setup", token)).body.secret as string;
          return original(...args);
        });
        return rotated;
      }

      test("responde 409 y no activa el 2FA con un secreto que el código no verificó", async () => {
        const { user, token, secret } = await pendingSetup("tf-enable-race");
        const rotated = rotateSecretBeforeEnableTransaction(token);
        const secretBefore = (await dbUser(user.id)).twoFactorSecretEnc;

        const res = await post("enable", token, { code: codeFor(secret) });

        expect(rotated.secret).toEqual(expect.any(String));
        expect(rotated.secret).not.toBe(secret);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("TWO_FACTOR_NOT_SETUP");
        const stored = await dbUser(user.id);
        expect(stored.twoFactorEnabledAt).toBeNull();
        expect(stored.tokenVersion).toBe(user.tokenVersion);
        expect(stored.twoFactorSecretEnc).not.toBe(secretBefore);
        expect(decryptSecret(stored.twoFactorSecretEnc as string, user.id)).toBe(rotated.secret);
        expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } })).toBe(0);
        expect(enabledNotice).not.toHaveBeenCalled();
      });

      test("el código del secreto nuevo sí activa después de la carrera", async () => {
        const { user, token, secret } = await pendingSetup("tf-enable-race-retry");
        const rotated = rotateSecretBeforeEnableTransaction(token);
        await post("enable", token, { code: codeFor(secret) });

        const retry = await post("enable", token, { code: codeFor(rotated.secret as string) });

        expect(retry.status).toBe(200);
        const stored = await dbUser(user.id);
        expect(stored.twoFactorEnabledAt).not.toBeNull();
        expect(decryptSecret(stored.twoFactorSecretEnc as string, user.id)).toBe(rotated.secret);
        expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } })).toBe(10);
      });
    });

    test("sin code en el body responde 400 de validación", async () => {
      const { token } = await pendingSetup("tf-enable-validation");

      const res = await post("enable", token, {});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Datos inválidos");
    });
  });

  describe("GET /2fa/status", () => {
    const status = (token: string) => request(app).get("/api/auth/2fa/status").set(bearer(token));

    test("sin 2FA informa apagado, cero códigos y sin reinicio", async () => {
      const { token } = await newUser("tf-status-off");

      const res = await status(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ enabled: false, recoveryCodesRemaining: 0, resetEffectiveAt: null });
    });

    test("con el alta sin confirmar sigue apagado", async () => {
      const { token } = await newUser("tf-status-pending");
      await post("setup", token);

      const res = await status(token);

      expect(res.body).toEqual({ enabled: false, recoveryCodesRemaining: 0, resetEffectiveAt: null });
    });

    test("cuenta solo los códigos sin usar: 8 tras gastar 2", async () => {
      const { user, token } = await enabledUser("tf-status-count");
      const rows = await prisma.twoFactorRecoveryCode.findMany({ where: { userId: user.id }, take: 2 });
      await prisma.twoFactorRecoveryCode.updateMany({
        where: { id: { in: rows.map((row) => row.id) } },
        data: { usedAt: new Date() },
      });

      const res = await status(token);

      expect(res.body).toEqual({ enabled: true, recoveryCodesRemaining: 8, resetEffectiveAt: null });
    });

    test("con un reinicio pendiente informa requested_at + 72 h", async () => {
      const requestedAt = new Date(Date.now() - 60 * 60 * 1000);
      const { token } = await enabledUser("tf-status-reset", { resetRequestedAt: requestedAt });

      const res = await status(token);

      expect(res.body.resetEffectiveAt).toBe(new Date(requestedAt.getTime() + RESET_WAIT_MS).toISOString());
    });

    test("ninguna respuesta (status, /me, login) filtra el secreto, los códigos ni los contadores", async () => {
      const { user, token, secret, recoveryCodes } = await enabledUser("tf-status-leak", { failedAttempts: 2 });

      const bodies = [
        (await status(token)).body,
        (await request(app).get("/api/auth/me").set(bearer(token))).body,
        (await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD })).body,
      ];

      const serialized = JSON.stringify(bodies);
      expect(serialized).not.toContain(secret);
      for (const code of recoveryCodes) {
        expect(serialized).not.toContain(code);
      }
      expect(serialized).not.toMatch(/twoFactorSecret|twoFactorFailed|twoFactorLocked|twoFactorLastStep|ResetRequested/i);
      expect(serialized).toContain("twoFactorEnabled");
    });
  });

  describe("POST /2fa/disable", () => {
    test("con contraseña y TOTP apaga todo: limpia el estado, borra los códigos y renueva la sesión", async () => {
      const { user, token, secret } = await enabledUser("tf-disable-totp", { failedAttempts: 2, lastStep: 5 });

      const res = await post("disable", token, { password: PASSWORD, code: codeFor(secret) });

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["token", "user"]);
      expect(res.body.user.twoFactorEnabled).toBe(false);

      const stored = await dbUser(user.id);
      expect(stored).toMatchObject({
        twoFactorSecretEnc: null,
        twoFactorEnabledAt: null,
        twoFactorLastStep: null,
        twoFactorFailedAttempts: 0,
        twoFactorLockedUntil: null,
        twoFactorResetRequestedAt: null,
        tokenVersion: user.tokenVersion + 1,
      });
      expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } })).toBe(0);
      expect(await meStatus(token)).toBe(401);
      expect(await meStatus(res.body.token)).toBe(200);
    });

    test("después de apagarlo el login devuelve la sesión directo y se avisa por mail", async () => {
      const { user, token, secret } = await enabledUser("tf-disable-login", {});

      await post("disable", token, { password: PASSWORD, code: codeFor(secret) });
      const login = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });

      expect(login.body.token).toEqual(expect.any(String));
      expect(login.body).not.toHaveProperty("twoFactorRequired");
      expect(disabledNotice).toHaveBeenCalledTimes(1);
      expect(disabledNotice).toHaveBeenCalledWith(user.email);
    });

    test("acepta un código de recuperación en lugar del TOTP", async () => {
      const { user, token, recoveryCodes } = await enabledUser("tf-disable-recovery");

      const res = await post("disable", token, { password: PASSWORD, code: recoveryCodes[0] });

      expect(res.status).toBe(200);
      expect((await dbUser(user.id)).twoFactorEnabledAt).toBeNull();
    });

    test("con la contraseña mal responde 403 sin evaluar el código ni tocar el contador", async () => {
      const { user, token, secret } = await enabledUser("tf-disable-wrongpass", { failedAttempts: 2, lastStep: 5 });

      const res = await post("disable", token, { password: "WrongPass123", code: codeFor(secret) });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("INVALID_PASSWORD");
      const stored = await dbUser(user.id);
      expect(stored.twoFactorEnabledAt).not.toBeNull();
      expect(stored.twoFactorFailedAttempts).toBe(2);
      expect(stored.twoFactorLastStep).toBe(5);
      expect(disabledNotice).not.toHaveBeenCalled();
    });

    test("con la contraseña bien y el código mal responde 400 (nunca 401) y cuenta el fallo", async () => {
      const { user, token, secret } = await enabledUser("tf-disable-wrongcode");

      const res = await post("disable", token, { password: PASSWORD, code: wrongCodeFor(secret) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_TWO_FACTOR_CODE");
      const stored = await dbUser(user.id);
      expect(stored.twoFactorEnabledAt).not.toBeNull();
      expect(stored.twoFactorFailedAttempts).toBe(1);
      expect(await meStatus(token)).toBe(200);
    });

    test("un TOTP ya gastado en el login no sirve para desactivar (replay)", async () => {
      const { user, token, secret } = await enabledUser("tf-disable-replay");
      const code = codeFor(secret);
      const login = await request(app)
        .post("/api/auth/2fa/login")
        .send({ twoFactorToken: await challengeFor(user.email), code });
      expect(login.status).toBe(200);

      const res = await post("disable", token, { password: PASSWORD, code });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_TWO_FACTOR_CODE");
    });

    test("con la cuenta bloqueada responde 429 aunque el código sea correcto", async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      const { user, token, secret } = await enabledUser("tf-disable-locked", { failedAttempts: 5, lockedUntil });

      const res = await post("disable", token, { password: PASSWORD, code: codeFor(secret) });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("TWO_FACTOR_LOCKED");
      expect((await dbUser(user.id)).twoFactorEnabledAt).not.toBeNull();
    });

    test("sin 2FA activo responde 409 TWO_FACTOR_NOT_ENABLED", async () => {
      const { token } = await newUser("tf-disable-off");

      const res = await post("disable", token, { password: PASSWORD, code: "123456" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TWO_FACTOR_NOT_ENABLED");
    });

    test("borra el reinicio pendiente, invalida sus links y mata los desafíos de login", async () => {
      const { user, token, secret } = await enabledUser("tf-disable-pending", {
        resetRequestedAt: new Date(Date.now() - 60 * 60 * 1000),
      });
      const challenge = await challengeFor(user.email);
      await issueAuthToken(user.id, "two_factor_reset");
      await issueAuthToken(user.id, "two_factor_reset_cancel");

      const res = await post("disable", token, { password: PASSWORD, code: codeFor(secret) });

      expect(res.status).toBe(200);
      expect((await dbUser(user.id)).twoFactorResetRequestedAt).toBeNull();
      expect(
        await prisma.authToken.count({
          where: {
            userId: user.id,
            usedAt: null,
            type: { in: ["two_factor_login", "two_factor_reset", "two_factor_reset_cancel"] },
          },
        })
      ).toBe(0);
      const stale = await request(app).post("/api/auth/2fa/login").send({ twoFactorToken: challenge, code: "123456" });
      expect(stale.status).toBe(400);
      expect(stale.body.error.code).toBe("TWO_FACTOR_CHALLENGE_INVALID");
    });

    test("si el aviso falla igual responde 200 y el 2FA queda apagado", async () => {
      disabledNotice.mockRejectedValue(new Error("smtp caído"));
      jest.spyOn(console, "error").mockImplementation(() => {});
      const { user, token, secret } = await enabledUser("tf-disable-mailfail");

      const res = await post("disable", token, { password: PASSWORD, code: codeFor(secret) });

      expect(res.status).toBe(200);
      expect((await dbUser(user.id)).twoFactorEnabledAt).toBeNull();
    });

    test("sin password o sin code en el body responde 400 de validación", async () => {
      const { token } = await enabledUser("tf-disable-validation");

      const noPassword = await post("disable", token, { code: "123456" });
      const noCode = await post("disable", token, { password: PASSWORD });

      expect(noPassword.status).toBe(400);
      expect(noCode.status).toBe(400);
      expect(noCode.body.error.message).toBe("Datos inválidos");
    });
  });

  describe("POST /2fa/recovery-codes", () => {
    test("con un TOTP vigente reemplaza el juego: los viejos mueren, los nuevos sirven y la sesión se renueva", async () => {
      const { user, token, secret, recoveryCodes: oldCodes } = await enabledUser("tf-regen-ok");

      const res = await post("recovery-codes", token, { code: codeFor(secret) });

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["recoveryCodes", "token", "user"]);
      expect(res.body.recoveryCodes).toHaveLength(10);
      for (const code of res.body.recoveryCodes) {
        expect(code).toMatch(RECOVERY_FORMAT);
        expect(oldCodes).not.toContain(code);
      }
      expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } })).toBe(10);
      expect((await dbUser(user.id)).tokenVersion).toBe(user.tokenVersion + 1);
      expect(await meStatus(token)).toBe(401);
      expect(await meStatus(res.body.token)).toBe(200);

      const withOld = await request(app)
        .post("/api/auth/2fa/login")
        .send({ twoFactorToken: await challengeFor(user.email), code: oldCodes[0] });
      expect(withOld.status).toBe(400);
      const withNew = await request(app)
        .post("/api/auth/2fa/login")
        .send({ twoFactorToken: await challengeFor(user.email), code: res.body.recoveryCodes[0] });
      expect(withNew.status).toBe(200);
    });

    test("no acepta un código de recuperación: 400 y no cambia nada", async () => {
      const { user, token, recoveryCodes } = await enabledUser("tf-regen-recovery");

      const res = await post("recovery-codes", token, { code: recoveryCodes[0] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_TWO_FACTOR_CODE");
      expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id, usedAt: null } })).toBe(10);
      expect((await dbUser(user.id)).tokenVersion).toBe(user.tokenVersion);
    });

    test("un TOTP incorrecto responde 400 y suma un fallo al contador compartido", async () => {
      const { user, token, secret } = await enabledUser("tf-regen-wrong");

      const res = await post("recovery-codes", token, { code: wrongCodeFor(secret) });

      expect(res.status).toBe(400);
      expect((await dbUser(user.id)).twoFactorFailedAttempts).toBe(1);
    });

    test("con la cuenta bloqueada responde 429", async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      const { token, secret } = await enabledUser("tf-regen-locked", { failedAttempts: 5, lockedUntil });

      const res = await post("recovery-codes", token, { code: codeFor(secret) });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe("TWO_FACTOR_LOCKED");
    });

    test("sin 2FA activo responde 409 TWO_FACTOR_NOT_ENABLED", async () => {
      const { token } = await newUser("tf-regen-off");

      const res = await post("recovery-codes", token, { code: "123456" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TWO_FACTOR_NOT_ENABLED");
    });
  });

  describe("producción sin TWO_FACTOR_ENCRYPTION_KEY", () => {
    const originalEnv = { nodeEnv: process.env.NODE_ENV, key: process.env.TWO_FACTOR_ENCRYPTION_KEY };

    afterEach(() => {
      process.env.NODE_ENV = originalEnv.nodeEnv;
      if (originalEnv.key === undefined) {
        delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
      } else {
        process.env.TWO_FACTOR_ENCRYPTION_KEY = originalEnv.key;
      }
    });

    function productionWithoutKey() {
      process.env.NODE_ENV = "production";
      delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
    }

    test("el alta responde 503 nombrando la variable y el login sin 2FA sigue andando", async () => {
      const { user, token } = await newUser("tf-prod-setup");
      productionWithoutKey();

      const setup = await post("setup", token);
      const login = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });

      expect(setup.status).toBe(503);
      expect(setup.body.error.code).toBe("TWO_FACTOR_NOT_CONFIGURED");
      expect(setup.body.error.message).toContain("TWO_FACTOR_ENCRYPTION_KEY");
      expect(login.status).toBe(200);
      expect(login.body.token).toEqual(expect.any(String));
      expect((await dbUser(user.id)).twoFactorSecretEnc).toBeNull();
    });

    test("desactivar responde 503 sin gastarle intentos al usuario", async () => {
      const { user, token, secret } = await enabledUser("tf-prod-disable");
      productionWithoutKey();

      const res = await post("disable", token, { password: PASSWORD, code: codeFor(secret) });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe("TWO_FACTOR_NOT_CONFIGURED");
      const stored = await dbUser(user.id);
      expect(stored.twoFactorFailedAttempts).toBe(0);
      expect(stored.twoFactorEnabledAt).not.toBeNull();
    });
  });

  describe("producción sin SMTP_HOST", () => {
    const originalEnv = {
      nodeEnv: process.env.NODE_ENV,
      key: process.env.TWO_FACTOR_ENCRYPTION_KEY,
      smtpHost: process.env.SMTP_HOST,
    };

    function restoreEnv(name: "NODE_ENV" | "TWO_FACTOR_ENCRYPTION_KEY" | "SMTP_HOST", value: string | undefined) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }

    afterEach(() => {
      restoreEnv("NODE_ENV", originalEnv.nodeEnv);
      restoreEnv("TWO_FACTOR_ENCRYPTION_KEY", originalEnv.key);
      restoreEnv("SMTP_HOST", originalEnv.smtpHost);
    });

    /** Producción con la clave de 2FA puesta (hace falta) pero sin servidor de correo. */
    function productionWithoutSmtp() {
      process.env.NODE_ENV = "production";
      process.env.TWO_FACTOR_ENCRYPTION_KEY = "ab".repeat(32);
      delete process.env.SMTP_HOST;
      // Estos tests usan el mail real: sin los mocks de beforeEach.
      enabledNotice.mockRestore();
      disabledNotice.mockRestore();
    }

    test("el mail real de aviso falla con 503 MAIL_NOT_CONFIGURED en esta configuración", async () => {
      productionWithoutSmtp();

      await expect(mailService.sendTwoFactorEnabled("alguien@example.com")).rejects.toMatchObject({
        statusCode: 503,
        code: "MAIL_NOT_CONFIGURED",
      });
      await expect(mailService.sendTwoFactorDisabled("alguien@example.com")).rejects.toMatchObject({
        statusCode: 503,
        code: "MAIL_NOT_CONFIGURED",
      });
    });

    test("activar responde 200 y deja el 2FA activo: el error del aviso se loguea, no se propaga", async () => {
      productionWithoutSmtp();
      const logged = jest.spyOn(console, "error").mockImplementation(() => {});
      const { user, token } = await newUser("tf-prod-nosmtp-enable");
      const setup = await post("setup", token);
      expect(setup.status).toBe(200);

      const res = await post("enable", token, { code: codeFor(setup.body.secret as string) });

      expect(res.status).toBe(200);
      expect(res.body.recoveryCodes).toHaveLength(10);
      expect((await dbUser(user.id)).twoFactorEnabledAt).not.toBeNull();
      expect(logged).toHaveBeenCalledWith(
        expect.stringContaining("activación"),
        expect.objectContaining({ statusCode: 503, code: "MAIL_NOT_CONFIGURED" })
      );
    });

    test("desactivar responde 200 y deja el 2FA apagado: el error del aviso se loguea, no se propaga", async () => {
      productionWithoutSmtp();
      const logged = jest.spyOn(console, "error").mockImplementation(() => {});
      const { user, token, secret } = await enabledUser("tf-prod-nosmtp-disable");

      const res = await post("disable", token, { password: PASSWORD, code: codeFor(secret) });

      expect(res.status).toBe(200);
      expect((await dbUser(user.id)).twoFactorEnabledAt).toBeNull();
      expect(logged).toHaveBeenCalledWith(
        expect.stringContaining("desactivación"),
        expect.objectContaining({ statusCode: 503, code: "MAIL_NOT_CONFIGURED" })
      );
    });
  });
});
