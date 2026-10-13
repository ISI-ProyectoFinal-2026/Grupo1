import { AddressInfo } from "net";
import { createServer, Server as HttpServer } from "http";
import { Request, Response } from "express";
import request from "supertest";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { optionalAuth } from "../../src/middlewares/auth.middleware";
import { hashAuthToken } from "../../src/services/auth-tokens.service";
import * as mailService from "../../src/services/mail.service";
import { initChatSocket } from "../../src/sockets/chat.socket";
import { codeFor, seedTwoFactor, wrongCodeFor } from "../helpers/two-factor";
import { createTestUser } from "../helpers/users";

const PASSWORD = "Password123";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RESET_WAIT_MS = 72 * 60 * 60 * 1000;
const PUBLIC_USER_KEYS = [
  "createdAt",
  "email",
  "emailVerifiedAt",
  "fullName",
  "id",
  "phone",
  "role",
  "twoFactorEnabled",
  "updatedAt",
];

describe("login en dos pasos", () => {
  const userIds: number[] = [];
  let recoveryNoticeSpy: jest.SpyInstance;

  beforeEach(() => {
    recoveryNoticeSpy = jest.spyOn(mailService, "sendTwoFactorRecoveryCodeUsed").mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function twoFactorUser(prefix: string, options: Parameters<typeof seedTwoFactor>[1] = {}) {
    const { user, token } = await createTestUser({ prefix, password: PASSWORD });
    userIds.push(user.id);
    const seeded = await seedTwoFactor(user.id, options);
    return { user, token, ...seeded };
  }

  async function passwordLogin(email: string, password = PASSWORD) {
    return request(app).post("/api/auth/login").send({ email, password });
  }

  async function challengeFor(email: string): Promise<string> {
    const res = await passwordLogin(email);
    return res.body.twoFactorToken as string;
  }

  async function secondFactor(twoFactorToken: string, code: string) {
    return request(app).post("/api/auth/2fa/login").send({ twoFactorToken, code });
  }

  describe("POST /api/auth/login con 2FA activo", () => {
    test("con la contraseña bien devuelve un desafío y nunca un token ni el usuario", async () => {
      const { user } = await twoFactorUser("tf-login-challenge");

      const res = await passwordLogin(user.email);

      expect(res.status).toBe(200);
      expect(res.body.twoFactorRequired).toBe(true);
      expect(res.body.twoFactorToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Object.keys(res.body).sort()).toEqual(["twoFactorRequired", "twoFactorToken"]);
    });

    test("guarda solo el hash del desafío, con vigencia de 5 minutos", async () => {
      const { user } = await twoFactorUser("tf-login-hashed");

      const raw = await challengeFor(user.email);

      const rows = await prisma.authToken.findMany({ where: { userId: user.id, type: "two_factor_login" } });
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).toBe(hashAuthToken(raw));
      expect(rows[0].tokenHash).not.toBe(raw);
      const ttl = rows[0].expiresAt.getTime() - rows[0].createdAt.getTime();
      expect(Math.abs(ttl - CHALLENGE_TTL_MS)).toBeLessThan(5_000);
    });

    test("contraseña incorrecta: el mismo 401 genérico que un email inexistente y ningún desafío", async () => {
      const { user } = await twoFactorUser("tf-login-wrongpass");

      const wrong = await passwordLogin(user.email, "WrongPass123");
      const unknown = await passwordLogin("no-existe-2fa@example.com", "WrongPass123");

      expect(wrong.status).toBe(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body.error.message).toBe("Credenciales inválidas");
      expect(await prisma.authToken.count({ where: { userId: user.id, type: "two_factor_login" } })).toBe(0);
    });

    test("un desafío nuevo reemplaza al anterior", async () => {
      const { user, secret } = await twoFactorUser("tf-login-supersede");
      const first = await challengeFor(user.email);
      const second = await challengeFor(user.email);

      const stale = await secondFactor(first, codeFor(secret));
      const fresh = await secondFactor(second, codeFor(secret));

      expect(stale.status).toBe(400);
      expect(stale.body.error.code).toBe("TWO_FACTOR_CHALLENGE_INVALID");
      expect(fresh.status).toBe(200);
    });

    test("con un reinicio pendiente el desafío informa resetEffectiveAt (requested_at + 72 h)", async () => {
      const requestedAt = new Date(Date.now() - 60 * 60 * 1000);
      const { user } = await twoFactorUser("tf-login-pending", { resetRequestedAt: requestedAt });

      const res = await passwordLogin(user.email);

      expect(res.status).toBe(200);
      expect(res.body.twoFactorRequired).toBe(true);
      expect(res.body.resetEffectiveAt).toBe(new Date(requestedAt.getTime() + RESET_WAIT_MS).toISOString());
    });

    test("sin reinicio pendiente el desafío no trae resetEffectiveAt", async () => {
      const { user } = await twoFactorUser("tf-login-nopending");

      const res = await passwordLogin(user.email);

      expect(res.body.twoFactorRequired).toBe(true);
      expect(res.body).not.toHaveProperty("resetEffectiveAt");
    });
  });

  describe("POST /api/auth/login sin 2FA activo", () => {
    test("sigue devolviendo { token, user } con twoFactorEnabled false", async () => {
      const { user } = await createTestUser({ prefix: "tf-login-plain", password: PASSWORD });
      userIds.push(user.id);

      const res = await passwordLogin(user.email);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["token", "user"]);
      expect(res.body.token.split(".")).toHaveLength(3);
      expect(Object.keys(res.body.user).sort()).toEqual(PUBLIC_USER_KEYS);
      expect(res.body.user.twoFactorEnabled).toBe(false);
    });

    test("un alta sin confirmar (secreto guardado, 2FA apagado) no pide segundo paso", async () => {
      const { user } = await twoFactorUser("tf-login-pendingsetup", { enabled: false });

      const res = await passwordLogin(user.email);

      expect(res.status).toBe(200);
      expect(res.body.token.split(".")).toHaveLength(3);
      expect(res.body.user.twoFactorEnabled).toBe(false);
      expect(res.body).not.toHaveProperty("twoFactorRequired");
    });
  });

  describe("GET /api/auth/me", () => {
    test("refleja twoFactorEnabled y no filtra secreto, contadores ni datos de reinicio", async () => {
      const enabled = await twoFactorUser("tf-me-enabled", { failedAttempts: 2, resetRequestedAt: new Date() });
      const plain = await createTestUser({ prefix: "tf-me-plain" });
      userIds.push(plain.user.id);

      const withTwoFactor = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${enabled.token}`);
      const without = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${plain.token}`);

      expect(withTwoFactor.status).toBe(200);
      expect(withTwoFactor.body.twoFactorEnabled).toBe(true);
      expect(Object.keys(withTwoFactor.body).sort()).toEqual(PUBLIC_USER_KEYS);
      expect(JSON.stringify(withTwoFactor.body)).not.toContain(enabled.secret);
      expect(without.body.twoFactorEnabled).toBe(false);
      expect(Object.keys(without.body).sort()).toEqual(PUBLIC_USER_KEYS);
    });
  });

  describe("POST /api/auth/2fa/login", () => {
    test("con un TOTP válido devuelve { token, user }, no toca tokenVersion ni otras sesiones y no manda mail", async () => {
      const { user, token: otherSession, secret } = await twoFactorUser("tf-2fa-totp");
      const challenge = await challengeFor(user.email);

      const res = await secondFactor(challenge, codeFor(secret));

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["token", "user"]);
      expect(res.body.user.twoFactorEnabled).toBe(true);
      expect(Object.keys(res.body.user).sort()).toEqual(PUBLIC_USER_KEYS);
      const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`);
      expect(me.status).toBe(200);
      const other = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${otherSession}`);
      expect(other.status).toBe(200);
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored.tokenVersion).toBe(user.tokenVersion);
      expect(recoveryNoticeSpy).not.toHaveBeenCalled();
    });

    test("un código equivocado responde 400 INVALID_TWO_FACTOR_CODE, sin sesión, y el desafío sigue sirviendo", async () => {
      const { user, secret } = await twoFactorUser("tf-2fa-wrongcode");
      const challenge = await challengeFor(user.email);

      const wrong = await secondFactor(challenge, wrongCodeFor(secret));
      const right = await secondFactor(challenge, codeFor(secret));

      expect(wrong.status).toBe(400);
      expect(wrong.body.error.code).toBe("INVALID_TWO_FACTOR_CODE");
      expect(wrong.body).not.toHaveProperty("token");
      expect(right.status).toBe(200);
    });

    test("el 5to fallo responde 429 y el desafío sobrevive al bloqueo hasta que vence", async () => {
      const { user, secret } = await twoFactorUser("tf-2fa-lock", { failedAttempts: 4 });
      const challenge = await challengeFor(user.email);

      const locking = await secondFactor(challenge, wrongCodeFor(secret));
      const whileLocked = await secondFactor(challenge, codeFor(secret));
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorLockedUntil: new Date(Date.now() - 1000) } });
      const afterLock = await secondFactor(challenge, codeFor(secret));

      expect(locking.status).toBe(429);
      expect(locking.body.error.code).toBe("TWO_FACTOR_LOCKED");
      expect(locking.body.error.details).toEqual({ retryAfterSeconds: 900 });
      expect(whileLocked.status).toBe(429);
      expect(whileLocked.body.error.code).toBe("TWO_FACTOR_LOCKED");
      expect(afterLock.status).toBe(200);
    });

    test("un TOTP ya usado en un login anterior se rechaza aunque el desafío sea nuevo", async () => {
      const { user, secret } = await twoFactorUser("tf-2fa-replay");
      const code = codeFor(secret);
      const first = await secondFactor(await challengeFor(user.email), code);

      const replay = await secondFactor(await challengeFor(user.email), code);

      expect(first.status).toBe(200);
      expect(replay.status).toBe(400);
      expect(replay.body.error.code).toBe("INVALID_TWO_FACTOR_CODE");
    });

    test("un desafío vencido o desconocido responde 400 TWO_FACTOR_CHALLENGE_INVALID", async () => {
      const { user, secret } = await twoFactorUser("tf-2fa-expired");
      const expired = await challengeFor(user.email);
      await prisma.authToken.updateMany({
        where: { tokenHash: hashAuthToken(expired) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const expiredRes = await secondFactor(expired, codeFor(secret));
      const unknownRes = await secondFactor("a".repeat(43), codeFor(secret));

      for (const res of [expiredRes, unknownRes]) {
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("TWO_FACTOR_CHALLENGE_INVALID");
      }
    });

    test("el desafío es de un solo uso", async () => {
      const { user, secret } = await twoFactorUser("tf-2fa-single");
      const challenge = await challengeFor(user.email);
      const first = await secondFactor(challenge, codeFor(secret));

      const reuse = await secondFactor(challenge, codeFor(secret, 1));

      expect(first.status).toBe(200);
      expect(reuse.status).toBe(400);
      expect(reuse.body.error.code).toBe("TWO_FACTOR_CHALLENGE_INVALID");
    });

    test("dos pedidos en paralelo con el mismo desafío abren una sola sesión", async () => {
      const { user, secret } = await twoFactorUser("tf-2fa-parallel");
      const challenge = await challengeFor(user.email);

      const results = await Promise.all([
        secondFactor(challenge, codeFor(secret, 0)),
        secondFactor(challenge, codeFor(secret, 1)),
      ]);

      expect(results.map((res) => res.status).sort()).toEqual([200, 400]);
      expect(results.filter((res) => res.body.token)).toHaveLength(1);
    });

    test("si el usuario ya no tiene 2FA activo el desafío pendiente se rechaza", async () => {
      const { user, secret } = await twoFactorUser("tf-2fa-disabled");
      const challenge = await challengeFor(user.email);
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabledAt: null } });

      const res = await secondFactor(challenge, codeFor(secret));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("TWO_FACTOR_CHALLENGE_INVALID");
    });

    test("con un código de recuperación sube tokenVersion, mata las sesiones viejas y avisa por mail una vez", async () => {
      const { user, token: oldSession, recoveryCodes } = await twoFactorUser("tf-2fa-recovery");
      const challenge = await challengeFor(user.email);

      const res = await secondFactor(challenge, recoveryCodes[0]);

      expect(res.status).toBe(200);
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored.tokenVersion).toBe(user.tokenVersion + 1);
      const old = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldSession}`);
      expect(old.status).toBe(401);
      const fresh = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`);
      expect(fresh.status).toBe(200);
      expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id, usedAt: null } })).toBe(9);
      expect(recoveryNoticeSpy).toHaveBeenCalledTimes(1);
      expect(recoveryNoticeSpy).toHaveBeenCalledWith(user.email, 9);
    });

    test("un código de recuperación no se puede usar dos veces", async () => {
      const { user, recoveryCodes } = await twoFactorUser("tf-2fa-recovery-reuse");
      const first = await secondFactor(await challengeFor(user.email), recoveryCodes[0]);

      const second = await secondFactor(await challengeFor(user.email), recoveryCodes[0]);

      expect(first.status).toBe(200);
      expect(second.status).toBe(400);
      expect(second.body.error.code).toBe("INVALID_TWO_FACTOR_CODE");
    });

    test("si falla el aviso por mail el login igual responde 200 (y lo loguea)", async () => {
      const { user, recoveryCodes } = await twoFactorUser("tf-2fa-recovery-mailfail");
      recoveryNoticeSpy.mockRejectedValue(new Error("smtp caído"));
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await secondFactor(await challengeFor(user.email), recoveryCodes[0]);

      expect(res.status).toBe(200);
      expect(errorSpy).toHaveBeenCalled();
      const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored.tokenVersion).toBe(user.tokenVersion + 1);
    });

    test("valida el body: sin código responde 400 Datos inválidos", async () => {
      const res = await request(app).post("/api/auth/2fa/login").send({ twoFactorToken: "x" });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Datos inválidos");
    });
  });

  describe("el desafío no es una sesión", () => {
    test("requireAuth lo rechaza con 401", async () => {
      const { user } = await twoFactorUser("tf-bearer-require");
      const challenge = await challengeFor(user.email);

      const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${challenge}`);

      expect(res.status).toBe(401);
    });

    test("optionalAuth lo trata como visitante anónimo", async () => {
      const { user, token } = await twoFactorUser("tf-bearer-optional");
      const challenge = await challengeFor(user.email);
      const withChallenge = { headers: { authorization: `Bearer ${challenge}` } } as unknown as Request;
      const withSession = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;

      await optionalAuth(withChallenge, {} as Response, jest.fn());
      await optionalAuth(withSession, {} as Response, jest.fn());

      expect(withChallenge.userId).toBeUndefined();
      expect(withSession.userId).toBe(user.id);
    });

    describe("handshake del socket", () => {
      let httpServer: HttpServer;
      let port: number;
      const openSockets: ClientSocket[] = [];

      beforeAll(async () => {
        httpServer = createServer(app);
        initChatSocket(httpServer);
        await new Promise<void>((resolve) => httpServer.listen(0, resolve));
        port = (httpServer.address() as AddressInfo).port;
      });

      afterEach(() => {
        while (openSockets.length > 0) {
          openSockets.pop()!.close();
        }
      });

      afterAll(async () => {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      });

      function outcomeFor(token: string): Promise<string> {
        const client = ioc(`http://localhost:${port}`, {
          transports: ["websocket"],
          forceNew: true,
          reconnection: false,
          auth: { token },
        });
        openSockets.push(client);
        return new Promise((resolve) => {
          client.on("connect_error", (err) => resolve(err.message));
          client.on("connect", () => resolve("conectó"));
        });
      }

      test("rechaza el desafío y acepta la sesión del mismo usuario", async () => {
        const { user, token } = await twoFactorUser("tf-bearer-socket");
        const challenge = await challengeFor(user.email);

        expect(await outcomeFor(challenge)).toBe("Token inválido");
        expect(await outcomeFor(token)).toBe("conectó");
      });
    });
  });
});
