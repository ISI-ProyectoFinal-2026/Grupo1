import { AuthTokenType } from "@prisma/client";
import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { hashAuthToken, issueAuthToken } from "../../src/services/auth-tokens.service";
import * as mailService from "../../src/services/mail.service";
import { codeFor, seedTwoFactor, wrongCodeFor } from "../helpers/two-factor";
import { createTestUser } from "../helpers/users";

const PASSWORD = "Password123";
const HOUR_MS = 60 * 60 * 1000;
const RESET_WAIT_MS = 72 * HOUR_MS;
const CONFIRM_PATH = "/two-factor/reset/confirm";
const CANCEL_PATH = "/two-factor/reset/cancel";
const RESET_TOKEN_TYPES: AuthTokenType[] = ["two_factor_reset", "two_factor_reset_cancel"];
const ALL_TWO_FACTOR_TOKEN_TYPES: AuthTokenType[] = ["two_factor_login", ...RESET_TOKEN_TYPES];

function tokenFromLink(link: string): string {
  const token = new URL(link).searchParams.get("token");
  if (!token) {
    throw new Error(`el link no trae token: ${link}`);
  }
  return token;
}

describe("reinicio demorado de 2FA", () => {
  const userIds: number[] = [];
  let linkNotice: jest.SpyInstance;
  let pendingNotice: jest.SpyInstance;
  let cancelledNotice: jest.SpyInstance;
  let completedNotice: jest.SpyInstance;
  let recoveryNotice: jest.SpyInstance;

  beforeEach(() => {
    linkNotice = jest.spyOn(mailService, "sendTwoFactorResetLink").mockResolvedValue();
    pendingNotice = jest.spyOn(mailService, "sendTwoFactorResetPending").mockResolvedValue();
    cancelledNotice = jest.spyOn(mailService, "sendTwoFactorResetCancelled").mockResolvedValue();
    completedNotice = jest.spyOn(mailService, "sendTwoFactorResetCompleted").mockResolvedValue();
    recoveryNotice = jest.spyOn(mailService, "sendTwoFactorRecoveryCodeUsed").mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  /** Usuario con 2FA activo directo en la base y contraseña conocida. */
  async function twoFactorUser(prefix: string, seed: Parameters<typeof seedTwoFactor>[1] = {}) {
    const created = await createTestUser({ prefix, password: PASSWORD });
    userIds.push(created.user.id);
    const seeded = await seedTwoFactor(created.user.id, seed);
    return { ...created, ...seeded };
  }

  /** Igual, pero con un reinicio pedido hace `hoursAgo` horas. */
  function pendingUser(prefix: string, hoursAgo: number, seed: Parameters<typeof seedTwoFactor>[1] = {}) {
    return twoFactorUser(prefix, { ...seed, resetRequestedAt: new Date(Date.now() - hoursAgo * HOUR_MS) });
  }

  const dbUser = (id: number) => prisma.user.findUniqueOrThrow({ where: { id } });
  const meStatus = async (token: string) =>
    (await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`)).status;
  const passwordLogin = (email: string, password = PASSWORD) =>
    request(app).post("/api/auth/login").send({ email, password });
  const requestReset = (twoFactorToken: string, password = PASSWORD) =>
    request(app).post("/api/auth/2fa/reset/request").send({ twoFactorToken, password });
  const confirmReset = (token: string) => request(app).post("/api/auth/2fa/reset/confirm").send({ token });
  const cancelReset = (token: string) => request(app).post("/api/auth/2fa/reset/cancel").send({ token });
  const secondFactor = (twoFactorToken: string, code: string) =>
    request(app).post("/api/auth/2fa/login").send({ twoFactorToken, code });
  const tokenCount = (userId: number, type: AuthTokenType) => prisma.authToken.count({ where: { userId, type } });
  const liveTokenCount = (userId: number, types: AuthTokenType[]) =>
    prisma.authToken.count({ where: { userId, type: { in: types }, usedAt: null } });

  async function challengeFor(email: string): Promise<string> {
    const res = await passwordLogin(email);
    return res.body.twoFactorToken as string;
  }

  /** Recorre request y confirm por la API y devuelve los dos tokens que salieron por mail. */
  async function startReset(email: string) {
    const requested = await requestReset(await challengeFor(email));
    expect(requested.status).toBe(200);
    const confirmToken = tokenFromLink(linkNotice.mock.calls.at(-1)![1] as string);
    const confirmed = await confirmReset(confirmToken);
    expect(confirmed.status).toBe(200);
    const cancelToken = tokenFromLink(pendingNotice.mock.calls.at(-1)![1] as string);
    return { confirmToken, cancelToken, resetEffectiveAt: confirmed.body.resetEffectiveAt as string };
  }

  /** Corre `fn` como si el backend estuviera en producción sin SMTP_HOST (y restaura el entorno). */
  async function withProductionWithoutSmtp(fn: () => Promise<void>): Promise<void> {
    const original = {
      NODE_ENV: process.env.NODE_ENV,
      SMTP_HOST: process.env.SMTP_HOST,
      KEY: process.env.TWO_FACTOR_ENCRYPTION_KEY,
    };
    process.env.NODE_ENV = "production";
    delete process.env.SMTP_HOST;
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
    try {
      await fn();
    } finally {
      process.env.NODE_ENV = original.NODE_ENV;
      if (original.SMTP_HOST !== undefined) process.env.SMTP_HOST = original.SMTP_HOST;
      if (original.KEY !== undefined) process.env.TWO_FACTOR_ENCRYPTION_KEY = original.KEY;
    }
  }

  describe("POST /2fa/reset/request", () => {
    test("con desafío y contraseña manda el mail de confirmación y no toca el desafío ni el estado", async () => {
      const { user, secret } = await twoFactorUser("tf-req-ok");
      const challenge = await challengeFor(user.email);

      const res = await requestReset(challenge);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(["message"]);
      expect(linkNotice).toHaveBeenCalledTimes(1);
      const [to, link] = linkNotice.mock.calls[0] as [string, string];
      expect(to).toBe(user.email);
      expect(new URL(link).pathname).toBe(CONFIRM_PATH);
      const stored = await prisma.authToken.findMany({ where: { userId: user.id, type: "two_factor_reset" } });
      expect(stored).toHaveLength(1);
      expect(stored[0].tokenHash).toBe(hashAuthToken(tokenFromLink(link)));
      const after = await dbUser(user.id);
      expect(after.twoFactorResetRequestedAt).toBeNull();
      expect(after.twoFactorEnabledAt).not.toBeNull();
      expect(after.tokenVersion).toBe(user.tokenVersion);
      // el desafío sigue sirviendo para entrar con el segundo factor
      expect((await secondFactor(challenge, codeFor(secret))).status).toBe(200);
    });

    test("contraseña incorrecta: 403 INVALID_PASSWORD, sin token, sin mail y sin tocar el contador", async () => {
      const { user } = await twoFactorUser("tf-req-wrongpass");
      const challenge = await challengeFor(user.email);

      const res = await requestReset(challenge, "WrongPass123");

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("INVALID_PASSWORD");
      expect(linkNotice).not.toHaveBeenCalled();
      expect(await tokenCount(user.id, "two_factor_reset")).toBe(0);
      expect((await dbUser(user.id)).twoFactorFailedAttempts).toBe(0);
    });

    test("desafío inválido: 400 TWO_FACTOR_CHALLENGE_INVALID, aunque la contraseña también esté mal", async () => {
      await twoFactorUser("tf-req-badchallenge");

      const unknown = await requestReset("desafio-que-no-existe", "WrongPass123");

      expect(unknown.status).toBe(400);
      expect(unknown.body.error.code).toBe("TWO_FACTOR_CHALLENGE_INVALID");
      expect(linkNotice).not.toHaveBeenCalled();
    });

    test("desafío de un usuario que ya no tiene 2FA: 400 TWO_FACTOR_CHALLENGE_INVALID", async () => {
      const { user } = await twoFactorUser("tf-req-disabled");
      const challenge = await challengeFor(user.email);
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabledAt: null } });

      const res = await requestReset(challenge);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("TWO_FACTOR_CHALLENGE_INVALID");
      expect(linkNotice).not.toHaveBeenCalled();
    });

    test("cuenta bloqueada: igual puede pedirlo y no cambia el contador ni el bloqueo", async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      const { user } = await twoFactorUser("tf-req-locked", { failedAttempts: 5, lockedUntil });
      const challenge = await challengeFor(user.email);

      const res = await requestReset(challenge);

      expect(res.status).toBe(200);
      expect(linkNotice).toHaveBeenCalledTimes(1);
      const after = await dbUser(user.id);
      expect(after.twoFactorFailedAttempts).toBe(5);
      expect(after.twoFactorLockedUntil?.getTime()).toBe(lockedUntil.getTime());
    });

    test("cooldown de 60 s por usuario: a los 30 s es 429 sin token ni mail, a los 61 s vuelve a andar", async () => {
      const { user } = await twoFactorUser("tf-req-cooldown");
      const challenge = await challengeFor(user.email);
      expect((await requestReset(challenge)).status).toBe(200);
      const age = (seconds: number) =>
        prisma.authToken.updateMany({
          where: { userId: user.id, type: "two_factor_reset" },
          data: { createdAt: new Date(Date.now() - seconds * 1000) },
        });
      await age(30);

      const tooSoon = await requestReset(challenge);

      expect(tooSoon.status).toBe(429);
      expect(tooSoon.body.error.code).toBe("TWO_FACTOR_RESET_COOLDOWN");
      expect(tooSoon.body.error.details.retryAfterSeconds).toBeGreaterThanOrEqual(29);
      expect(tooSoon.body.error.details.retryAfterSeconds).toBeLessThanOrEqual(30);
      expect(linkNotice).toHaveBeenCalledTimes(1);
      expect(await tokenCount(user.id, "two_factor_reset")).toBe(1);

      await age(61);
      const later = await requestReset(challenge);

      expect(later.status).toBe(200);
      expect(linkNotice).toHaveBeenCalledTimes(2);
      expect(await tokenCount(user.id, "two_factor_reset")).toBe(2);
    });

    test("un pedido nuevo deja sin efecto el link anterior", async () => {
      const { user } = await twoFactorUser("tf-req-supersede");
      const challenge = await challengeFor(user.email);
      await requestReset(challenge);
      const first = tokenFromLink(linkNotice.mock.calls[0][1] as string);
      await prisma.authToken.updateMany({
        where: { userId: user.id, type: "two_factor_reset" },
        data: { createdAt: new Date(Date.now() - 120_000) },
      });
      await requestReset(challenge);
      const second = tokenFromLink(linkNotice.mock.calls[1][1] as string);

      const stale = await confirmReset(first);
      const fresh = await confirmReset(second);

      expect(stale.status).toBe(400);
      expect(fresh.status).toBe(200);
    });

    test("con un reinicio ya pendiente responde 200 sin token ni mail, aunque el cooldown esté vigente", async () => {
      const { user } = await pendingUser("tf-req-pending", 1);
      const before = (await dbUser(user.id)).twoFactorResetRequestedAt;
      await issueAuthToken(user.id, "two_factor_reset");
      const challenge = await challengeFor(user.email);

      const res = await requestReset(challenge);

      expect(res.status).toBe(200);
      expect(linkNotice).not.toHaveBeenCalled();
      expect(await tokenCount(user.id, "two_factor_reset")).toBe(1);
      expect((await dbUser(user.id)).twoFactorResetRequestedAt?.getTime()).toBe(before?.getTime());
    });

    test("el chequeo de mail va último: 403 antes que 503, 429 antes que 503, y recién después 503", async () => {
      const { user } = await twoFactorUser("tf-req-mail-last");
      const challenge = await challengeFor(user.email);

      await withProductionWithoutSmtp(async () => {
        const wrongPassword = await requestReset(challenge, "WrongPass123");
        expect(wrongPassword.status).toBe(403);

        await issueAuthToken(user.id, "two_factor_reset");
        const cooldown = await requestReset(challenge);
        expect(cooldown.status).toBe(429);

        await prisma.authToken.updateMany({
          where: { userId: user.id, type: "two_factor_reset" },
          data: { createdAt: new Date(Date.now() - 120_000) },
        });
        const misconfigured = await requestReset(challenge);
        expect(misconfigured.status).toBe(503);
        expect(misconfigured.body.error.code).toBe("MAIL_NOT_CONFIGURED");
        expect(misconfigured.body.error.message).toContain("SMTP_HOST");
      });

      expect(linkNotice).not.toHaveBeenCalled();
      expect(await tokenCount(user.id, "two_factor_reset")).toBe(1);
    });

    test("con un reinicio pendiente en producción sin SMTP responde 200 (el chequeo de mail no llega)", async () => {
      const { user } = await pendingUser("tf-req-pending-prod", 1);
      const challenge = await challengeFor(user.email);

      await withProductionWithoutSmtp(async () => {
        expect((await requestReset(challenge)).status).toBe(200);
      });
    });

    test("si el envío del mail falla el error se propaga (500) como en el reenvío de verificación", async () => {
      const { user } = await twoFactorUser("tf-req-mailfail");
      const challenge = await challengeFor(user.email);
      linkNotice.mockRejectedValue(new Error("smtp caído"));
      jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await requestReset(challenge);

      expect(res.status).toBe(500);
    });

    test("valida el body: faltan campos", async () => {
      const noPassword = await request(app).post("/api/auth/2fa/reset/request").send({ twoFactorToken: "x" });
      const noToken = await request(app).post("/api/auth/2fa/reset/request").send({ password: PASSWORD });

      expect(noPassword.status).toBe(400);
      expect(noToken.status).toBe(400);
      expect(noToken.body.error.message).toBe("Datos inválidos");
    });
  });

  describe("POST /2fa/reset/confirm", () => {
    async function confirmToken(userId: number): Promise<string> {
      return issueAuthToken(userId, "two_factor_reset");
    }

    test("arranca la espera con la hora de la base y avisa con el link de cancelación", async () => {
      const { user, token } = await twoFactorUser("tf-confirm-ok");
      const raw = await confirmToken(user.id);

      const res = await confirmReset(raw);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["message", "resetEffectiveAt"]);
      const stored = await dbUser(user.id);
      const requestedAt = stored.twoFactorResetRequestedAt as Date;
      expect(Math.abs(requestedAt.getTime() - Date.now())).toBeLessThan(10_000);
      expect(res.body.resetEffectiveAt).toBe(new Date(requestedAt.getTime() + RESET_WAIT_MS).toISOString());
      expect(stored.twoFactorEnabledAt).not.toBeNull();
      expect(stored.tokenVersion).toBe(user.tokenVersion);
      expect(await meStatus(token)).toBe(200);

      expect(pendingNotice).toHaveBeenCalledTimes(1);
      const [to, cancelLink, effectiveAt] = pendingNotice.mock.calls[0] as [string, string, Date];
      expect(to).toBe(user.email);
      expect(new URL(cancelLink).pathname).toBe(CANCEL_PATH);
      expect(effectiveAt.toISOString()).toBe(res.body.resetEffectiveAt);
      const cancelRows = await prisma.authToken.findMany({
        where: { userId: user.id, type: "two_factor_reset_cancel", usedAt: null },
      });
      expect(cancelRows).toHaveLength(1);
      expect(cancelRows[0].tokenHash).toBe(hashAuthToken(tokenFromLink(cancelLink)));
    });

    test("ignora cualquier hora que mande el cliente", async () => {
      const { user } = await twoFactorUser("tf-confirm-clienttime");
      const raw = await confirmToken(user.id);

      const res = await request(app)
        .post("/api/auth/2fa/reset/confirm")
        .send({ token: raw, requestedAt: "2020-01-01T00:00:00.000Z", resetEffectiveAt: "2020-01-04T00:00:00.000Z" });

      expect(res.status).toBe(200);
      const requestedAt = (await dbUser(user.id)).twoFactorResetRequestedAt as Date;
      expect(Math.abs(requestedAt.getTime() - Date.now())).toBeLessThan(10_000);
    });

    test("el token es de un solo uso: la segunda vez 400 TWO_FACTOR_LINK_INVALID", async () => {
      const { user } = await twoFactorUser("tf-confirm-reuse");
      const raw = await confirmToken(user.id);
      await confirmReset(raw);

      const again = await confirmReset(raw);

      expect(again.status).toBe(400);
      expect(again.body.error.code).toBe("TWO_FACTOR_LINK_INVALID");
      expect(pendingNotice).toHaveBeenCalledTimes(1);
    });

    test("token desconocido, vencido o de otro tipo: 400 TWO_FACTOR_LINK_INVALID y no arranca nada", async () => {
      const { user } = await twoFactorUser("tf-confirm-invalid");
      const expired = await confirmToken(user.id);
      await prisma.authToken.updateMany({
        where: { userId: user.id, type: "two_factor_reset" },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const cancelToken = await issueAuthToken(user.id, "two_factor_reset_cancel");
      const passwordReset = await issueAuthToken(user.id, "password_reset");

      for (const raw of ["token-que-no-existe", expired, cancelToken, passwordReset]) {
        const res = await confirmReset(raw);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("TWO_FACTOR_LINK_INVALID");
      }
      expect((await dbUser(user.id)).twoFactorResetRequestedAt).toBeNull();
      expect(pendingNotice).not.toHaveBeenCalled();
    });

    test("un link reemplazado por uno más nuevo ya no sirve", async () => {
      const { user } = await twoFactorUser("tf-confirm-superseded");
      const first = await confirmToken(user.id);
      const second = await confirmToken(user.id);

      expect((await confirmReset(first)).status).toBe(400);
      expect((await confirmReset(second)).status).toBe(200);
    });

    test("si el usuario ya no tiene 2FA responde 400, no arranca la espera y no gasta el token", async () => {
      const { user } = await twoFactorUser("tf-confirm-2fa-off");
      const raw = await confirmToken(user.id);
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabledAt: null } });

      const res = await confirmReset(raw);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("TWO_FACTOR_LINK_INVALID");
      expect((await dbUser(user.id)).twoFactorResetRequestedAt).toBeNull();
      expect(await liveTokenCount(user.id, ["two_factor_reset"])).toBe(1);
      expect(pendingNotice).not.toHaveBeenCalled();
    });

    test("reconfirmar con un reinicio pendiente devuelve la fecha original, sin token ni mail nuevos", async () => {
      const { user } = await twoFactorUser("tf-confirm-again");
      const first = await startReset(user.email);
      const requestedAt = (await dbUser(user.id)).twoFactorResetRequestedAt as Date;
      const newer = await confirmToken(user.id);

      const again = await confirmReset(newer);

      expect(again.status).toBe(200);
      expect(again.body.resetEffectiveAt).toBe(first.resetEffectiveAt);
      expect((await dbUser(user.id)).twoFactorResetRequestedAt?.getTime()).toBe(requestedAt.getTime());
      expect(pendingNotice).toHaveBeenCalledTimes(1);
      expect(await tokenCount(user.id, "two_factor_reset_cancel")).toBe(1);
      // el link de cancelación original sigue vivo
      expect((await cancelReset(first.cancelToken)).status).toBe(200);
    });

    test("si el aviso falla igual responde 200 y la espera queda corriendo", async () => {
      const { user } = await twoFactorUser("tf-confirm-noticefail");
      const raw = await confirmToken(user.id);
      pendingNotice.mockRejectedValue(new Error("smtp caído"));
      jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await confirmReset(raw);

      expect(res.status).toBe(200);
      expect((await dbUser(user.id)).twoFactorResetRequestedAt).not.toBeNull();
      expect(await liveTokenCount(user.id, ["two_factor_reset_cancel"])).toBe(1);
    });

    test("valida el body", async () => {
      const res = await request(app).post("/api/auth/2fa/reset/confirm").send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Datos inválidos");
    });
  });

  describe("POST /2fa/reset/cancel", () => {
    test("cancela sin sesión: limpia la espera, mantiene el 2FA, invalida los links y avisa una vez", async () => {
      const { user, token } = await twoFactorUser("tf-cancel-ok");
      const { cancelToken } = await startReset(user.email);
      const outstandingConfirm = await issueAuthToken(user.id, "two_factor_reset");

      const res = await cancelReset(cancelToken);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(["message"]);
      const stored = await dbUser(user.id);
      expect(stored.twoFactorResetRequestedAt).toBeNull();
      expect(stored.twoFactorEnabledAt).not.toBeNull();
      expect(stored.tokenVersion).toBe(user.tokenVersion);
      expect(await meStatus(token)).toBe(200);
      expect(await liveTokenCount(user.id, RESET_TOKEN_TYPES)).toBe(0);
      expect((await confirmReset(outstandingConfirm)).status).toBe(400);
      expect(cancelledNotice).toHaveBeenCalledTimes(1);
      expect(cancelledNotice).toHaveBeenCalledWith(user.email);
    });

    test("después de cancelar el login vuelve a pedir el segundo factor aunque pasen las 72 h", async () => {
      const { user } = await twoFactorUser("tf-cancel-login");
      const { cancelToken } = await startReset(user.email);
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorResetRequestedAt: new Date(Date.now() - 73 * HOUR_MS) },
      });
      await cancelReset(cancelToken);

      const login = await passwordLogin(user.email);

      expect(login.status).toBe(200);
      expect(login.body.twoFactorRequired).toBe(true);
      expect(login.body).not.toHaveProperty("token");
      expect(completedNotice).not.toHaveBeenCalled();
    });

    test("el link vale a las 71 h", async () => {
      const { user } = await twoFactorUser("tf-cancel-71h");
      const { cancelToken } = await startReset(user.email);
      const createdAt = new Date(Date.now() - 71 * HOUR_MS);
      await prisma.authToken.updateMany({
        where: { userId: user.id, type: "two_factor_reset_cancel" },
        data: { createdAt, expiresAt: new Date(createdAt.getTime() + 7 * 24 * HOUR_MS) },
      });

      const res = await cancelReset(cancelToken);

      expect(res.status).toBe(200);
      expect((await dbUser(user.id)).twoFactorResetRequestedAt).toBeNull();
    });

    test("reusar el link, uno desconocido o uno de otro tipo: 400 TWO_FACTOR_LINK_INVALID", async () => {
      const { user } = await twoFactorUser("tf-cancel-invalid");
      const { cancelToken, confirmToken } = await startReset(user.email);
      await cancelReset(cancelToken);
      const confirmType = await issueAuthToken(user.id, "two_factor_reset");

      for (const raw of [cancelToken, "token-que-no-existe", confirmType, confirmToken]) {
        const res = await cancelReset(raw);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("TWO_FACTOR_LINK_INVALID");
      }
      expect(cancelledNotice).toHaveBeenCalledTimes(1);
    });

    test("un link válido sin reinicio pendiente responde 200 y no manda el aviso", async () => {
      const { user } = await twoFactorUser("tf-cancel-nothing");
      const raw = await issueAuthToken(user.id, "two_factor_reset_cancel");

      const res = await cancelReset(raw);

      expect(res.status).toBe(200);
      expect(cancelledNotice).not.toHaveBeenCalled();
    });

    test("si el aviso falla igual responde 200 y el reinicio queda cancelado", async () => {
      const { user } = await twoFactorUser("tf-cancel-noticefail");
      const { cancelToken } = await startReset(user.email);
      cancelledNotice.mockRejectedValue(new Error("smtp caído"));
      jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await cancelReset(cancelToken);

      expect(res.status).toBe(200);
      expect((await dbUser(user.id)).twoFactorResetRequestedAt).toBeNull();
    });

    test("valida el body", async () => {
      const res = await request(app).post("/api/auth/2fa/reset/cancel").send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe("Datos inválidos");
    });
  });

  describe("cancelar el reinicio con un login real de segundo factor", () => {
    test("un TOTP válido limpia la espera, mata los links y manda el aviso de cancelación una vez", async () => {
      const { user, secret } = await twoFactorUser("tf-logincancel-totp");
      const { cancelToken, confirmToken } = await startReset(user.email);
      await issueAuthToken(user.id, "two_factor_reset");
      const challenge = await challengeFor(user.email);

      const res = await secondFactor(challenge, codeFor(secret));

      expect(res.status).toBe(200);
      expect((await dbUser(user.id)).twoFactorResetRequestedAt).toBeNull();
      expect(await liveTokenCount(user.id, RESET_TOKEN_TYPES)).toBe(0);
      expect((await cancelReset(cancelToken)).status).toBe(400);
      expect((await confirmReset(confirmToken)).status).toBe(400);
      expect(cancelledNotice).toHaveBeenCalledTimes(1);
      expect(cancelledNotice).toHaveBeenCalledWith(user.email);
      expect(recoveryNotice).not.toHaveBeenCalled();
    });

    test("un código de recuperación también cancela, además del aviso propio de ese login", async () => {
      const { user, recoveryCodes } = await twoFactorUser("tf-logincancel-recovery");
      await startReset(user.email);
      const challenge = await challengeFor(user.email);

      const res = await secondFactor(challenge, recoveryCodes[0]);

      expect(res.status).toBe(200);
      expect((await dbUser(user.id)).twoFactorResetRequestedAt).toBeNull();
      expect(cancelledNotice).toHaveBeenCalledTimes(1);
      expect(recoveryNotice).toHaveBeenCalledTimes(1);
      expect(recoveryNotice).toHaveBeenCalledWith(user.email, 9);
    });

    test("un código equivocado no cancela ni avisa", async () => {
      const { user, secret } = await twoFactorUser("tf-logincancel-wrong");
      await startReset(user.email);
      const before = (await dbUser(user.id)).twoFactorResetRequestedAt;
      const challenge = await challengeFor(user.email);

      const res = await secondFactor(challenge, wrongCodeFor(secret));

      expect(res.status).toBe(400);
      expect((await dbUser(user.id)).twoFactorResetRequestedAt?.getTime()).toBe(before?.getTime());
      expect(await liveTokenCount(user.id, ["two_factor_reset_cancel"])).toBe(1);
      expect(cancelledNotice).not.toHaveBeenCalled();
    });

    test("un intento bloqueado no cancela", async () => {
      const { user, secret } = await twoFactorUser("tf-logincancel-locked");
      await startReset(user.email);
      const challenge = await challengeFor(user.email);
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorFailedAttempts: 5, twoFactorLockedUntil: new Date(Date.now() + 10 * 60 * 1000) },
      });

      const res = await secondFactor(challenge, codeFor(secret));

      expect(res.status).toBe(429);
      expect((await dbUser(user.id)).twoFactorResetRequestedAt).not.toBeNull();
      expect(cancelledNotice).not.toHaveBeenCalled();
    });

    test("el login con contraseña sola no cancela", async () => {
      const { user } = await twoFactorUser("tf-logincancel-passonly");
      const started = await startReset(user.email);

      const login = await passwordLogin(user.email);

      expect(login.body.twoFactorRequired).toBe(true);
      expect(login.body.resetEffectiveAt).toBe(started.resetEffectiveAt);
      expect((await dbUser(user.id)).twoFactorResetRequestedAt).not.toBeNull();
      expect(cancelledNotice).not.toHaveBeenCalled();
    });

    test("sin reinicio pendiente un login de segundo factor no manda ningún aviso de cancelación", async () => {
      const { user, secret } = await twoFactorUser("tf-logincancel-nopending");
      const challenge = await challengeFor(user.email);

      const res = await secondFactor(challenge, codeFor(secret));

      expect(res.status).toBe(200);
      expect(cancelledNotice).not.toHaveBeenCalled();
    });

    test("si el aviso falla el login igual responde 200", async () => {
      const { user, secret } = await twoFactorUser("tf-logincancel-noticefail");
      await startReset(user.email);
      const challenge = await challengeFor(user.email);
      cancelledNotice.mockRejectedValue(new Error("smtp caído"));
      jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await secondFactor(challenge, codeFor(secret));

      expect(res.status).toBe(200);
      expect((await dbUser(user.id)).twoFactorResetRequestedAt).toBeNull();
    });
  });

  describe("completar el reinicio al hacer login con contraseña", () => {
    test("a los 71 h 59 min todavía devuelve el desafío con la fecha y no cambia nada", async () => {
      const requestedAt = new Date(Date.now() - (72 * 60 - 1) * 60 * 1000);
      const { user } = await twoFactorUser("tf-mature-early", { resetRequestedAt: requestedAt });

      const res = await passwordLogin(user.email);

      expect(res.status).toBe(200);
      expect(res.body.twoFactorRequired).toBe(true);
      expect(res.body).not.toHaveProperty("token");
      expect(res.body.resetEffectiveAt).toBe(new Date(requestedAt.getTime() + RESET_WAIT_MS).toISOString());
      const stored = await dbUser(user.id);
      expect(stored.twoFactorEnabledAt).not.toBeNull();
      expect(stored.tokenVersion).toBe(user.tokenVersion);
      expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } })).toBe(10);
      expect(completedNotice).not.toHaveBeenCalled();
    });

    test("a las 72 h devuelve la sesión, apaga el 2FA, borra los códigos y cierra las otras sesiones", async () => {
      const { user, token: oldToken } = await pendingUser("tf-mature-ok", 72, { failedAttempts: 3, lastStep: 123 });
      for (const type of ALL_TWO_FACTOR_TOKEN_TYPES) {
        await issueAuthToken(user.id, type);
      }

      const res = await passwordLogin(user.email);

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["token", "user"]);
      expect(res.body.user.twoFactorEnabled).toBe(false);
      const stored = await dbUser(user.id);
      expect(stored.twoFactorSecretEnc).toBeNull();
      expect(stored.twoFactorEnabledAt).toBeNull();
      expect(stored.twoFactorLastStep).toBeNull();
      expect(stored.twoFactorFailedAttempts).toBe(0);
      expect(stored.twoFactorLockedUntil).toBeNull();
      expect(stored.twoFactorResetRequestedAt).toBeNull();
      expect(stored.tokenVersion).toBe(user.tokenVersion + 1);
      expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id } })).toBe(0);
      expect(await liveTokenCount(user.id, ALL_TWO_FACTOR_TOKEN_TYPES)).toBe(0);
      expect(await meStatus(oldToken)).toBe(401);
      expect(await meStatus(res.body.token)).toBe(200);
      expect(completedNotice).toHaveBeenCalledTimes(1);
      expect(completedNotice).toHaveBeenCalledWith(user.email);
    });

    test("después de completarse el siguiente login entra directo y no vuelve a avisar", async () => {
      const { user } = await pendingUser("tf-mature-next", 80);
      await passwordLogin(user.email);

      const next = await passwordLogin(user.email);

      expect(next.status).toBe(200);
      expect(next.body.token.split(".")).toHaveLength(3);
      expect(next.body).not.toHaveProperty("twoFactorRequired");
      expect(completedNotice).toHaveBeenCalledTimes(1);
    });

    test("con la contraseña mal después de las 72 h responde 401 y no completa nada", async () => {
      const { user } = await pendingUser("tf-mature-wrongpass", 80);

      const res = await passwordLogin(user.email, "WrongPass123");

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Credenciales inválidas");
      const stored = await dbUser(user.id);
      expect(stored.twoFactorEnabledAt).not.toBeNull();
      expect(stored.twoFactorResetRequestedAt).not.toBeNull();
      expect(completedNotice).not.toHaveBeenCalled();
    });

    test("se completa aunque la cuenta esté bloqueada y deja el bloqueo limpio", async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      const { user } = await pendingUser("tf-mature-locked", 80, { failedAttempts: 5, lockedUntil });

      const res = await passwordLogin(user.email);

      expect(res.status).toBe(200);
      expect(res.body.token.split(".")).toHaveLength(3);
      const stored = await dbUser(user.id);
      expect(stored.twoFactorEnabledAt).toBeNull();
      expect(stored.twoFactorLockedUntil).toBeNull();
      expect(stored.twoFactorFailedAttempts).toBe(0);
    });

    test("se completa aunque falte la clave de cifrado en producción", async () => {
      const { user } = await pendingUser("tf-mature-nokey", 80);

      await withProductionWithoutSmtp(async () => {
        const res = await passwordLogin(user.email);

        expect(res.status).toBe(200);
        expect(res.body.token.split(".")).toHaveLength(3);
      });

      expect((await dbUser(user.id)).twoFactorEnabledAt).toBeNull();
    });

    test("dos logins vencidos en paralelo: se completa una vez, un solo aviso y las dos sesiones sirven", async () => {
      const { user, token: oldToken } = await pendingUser("tf-mature-parallel", 80);

      const [first, second] = await Promise.all([passwordLogin(user.email), passwordLogin(user.email)]);

      for (const res of [first, second]) {
        expect(res.status).toBe(200);
        expect(Object.keys(res.body).sort()).toEqual(["token", "user"]);
        expect(res.body.user.twoFactorEnabled).toBe(false);
        expect(await meStatus(res.body.token)).toBe(200);
      }
      expect((await dbUser(user.id)).tokenVersion).toBe(user.tokenVersion + 1);
      expect(completedNotice).toHaveBeenCalledTimes(1);
      expect(await meStatus(oldToken)).toBe(401);
    });

    test("si el aviso falla el login igual devuelve la sesión", async () => {
      const { user } = await pendingUser("tf-mature-noticefail", 80);
      completedNotice.mockRejectedValue(new Error("smtp caído"));
      jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await passwordLogin(user.email);

      expect(res.status).toBe(200);
      expect(res.body.token.split(".")).toHaveLength(3);
      expect((await dbUser(user.id)).twoFactorEnabledAt).toBeNull();
    });
  });

  describe("restablecer la contraseña por email (A21)", () => {
    async function resetPasswordByEmail(userId: number): Promise<void> {
      const raw = await issueAuthToken(userId, "password_reset");
      const res = await request(app).post("/api/auth/reset-password").send({ token: raw, password: "NewPassword123" });
      expect(res.status).toBe(200);
    }

    test("no desactiva el 2FA ni toca los códigos: el login sigue pidiendo el segundo factor", async () => {
      const { user } = await twoFactorUser("tf-a21-2fa");
      const before = await dbUser(user.id);

      await resetPasswordByEmail(user.id);

      const after = await dbUser(user.id);
      expect(after.twoFactorEnabledAt?.getTime()).toBe(before.twoFactorEnabledAt?.getTime());
      expect(after.twoFactorSecretEnc).toBe(before.twoFactorSecretEnc);
      expect(await prisma.twoFactorRecoveryCode.count({ where: { userId: user.id, usedAt: null } })).toBe(10);
      const login = await passwordLogin(user.email, "NewPassword123");
      expect(login.body.twoFactorRequired).toBe(true);
      expect(login.body).not.toHaveProperty("token");
    });

    test("un reinicio pendiente queda intacto y el desafío informa la fecha original", async () => {
      const { user } = await twoFactorUser("tf-a21-pending");
      const started = await startReset(user.email);
      const before = (await dbUser(user.id)).twoFactorResetRequestedAt as Date;

      await resetPasswordByEmail(user.id);

      expect((await dbUser(user.id)).twoFactorResetRequestedAt?.getTime()).toBe(before.getTime());
      const login = await passwordLogin(user.email, "NewPassword123");
      expect(login.body.twoFactorRequired).toBe(true);
      expect(login.body.resetEffectiveAt).toBe(started.resetEffectiveAt);
      expect(await liveTokenCount(user.id, ["two_factor_reset_cancel"])).toBe(1);
    });
  });
});
