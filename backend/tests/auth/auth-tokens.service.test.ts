import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import {
  AUTH_TOKEN_TTL_MS,
  consumeAuthToken,
  findValidAuthToken,
  hashAuthToken,
  INVALID_LINK_MESSAGE,
  invalidateAuthTokens,
  issueAuthToken,
  latestAuthTokenCreatedAt,
} from "../../src/services/auth-tokens.service";

describe("auth-tokens.service — latestAuthTokenCreatedAt()", () => {
  let userId: number;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `auth-tokens-latest-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test("sin tokens devuelve null", async () => {
    await expect(latestAuthTokenCreatedAt(userId, "email_verification")).resolves.toBeNull();
  });

  test("devuelve el created_at del último token del tipo, aunque ya esté invalidado o usado", async () => {
    await issueAuthToken(userId, "email_verification");
    const first = await prisma.authToken.findFirstOrThrow({ where: { userId, type: "email_verification" } });
    await prisma.authToken.update({
      where: { id: first.id },
      data: { createdAt: new Date(Date.now() - 3_600_000), usedAt: new Date() },
    });
    await issueAuthToken(userId, "email_verification");
    const latest = await prisma.authToken.findFirstOrThrow({
      where: { userId, type: "email_verification" },
      orderBy: { id: "desc" },
    });
    await prisma.authToken.update({ where: { id: latest.id }, data: { usedAt: new Date() } });

    await expect(latestAuthTokenCreatedAt(userId, "email_verification")).resolves.toEqual(latest.createdAt);
  });

  test("no mezcla tipos: un token de reset no cuenta para la verificación", async () => {
    const other = await prisma.user.create({
      data: { email: `auth-tokens-latest-other-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    try {
      await issueAuthToken(other.id, "password_reset");

      await expect(latestAuthTokenCreatedAt(other.id, "email_verification")).resolves.toBeNull();
      await expect(latestAuthTokenCreatedAt(other.id, "password_reset")).resolves.toEqual(expect.any(Date));
    } finally {
      await prisma.user.delete({ where: { id: other.id } });
    }
  });
});

describe("auth-tokens.service — tipos de segundo factor", () => {
  let userId: number;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `auth-tokens-2fa-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  async function rejection(promise: Promise<unknown>): Promise<AppError> {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      return error as AppError;
    }
    throw new Error("Se esperaba un AppError y no se lanzó nada");
  }

  test("las vigencias son 5 min, 30 min y 7 días", () => {
    expect(AUTH_TOKEN_TTL_MS.two_factor_login).toBe(5 * 60 * 1000);
    expect(AUTH_TOKEN_TTL_MS.two_factor_reset).toBe(30 * 60 * 1000);
    expect(AUTH_TOKEN_TTL_MS.two_factor_reset_cancel).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test("issueAuthToken guarda el vencimiento que corresponde al tipo", async () => {
    const before = Date.now();
    const raw = await issueAuthToken(userId, "two_factor_login");
    const row = await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(raw) } });

    expect(row.type).toBe("two_factor_login");
    expect(row.expiresAt.getTime() - before).toBeGreaterThanOrEqual(5 * 60 * 1000 - 50);
    expect(row.expiresAt.getTime() - before).toBeLessThanOrEqual(5 * 60 * 1000 + 5000);
  });

  describe("findValidAuthToken()", () => {
    test("devuelve el dueño sin consumir el token (se puede consultar dos veces y después consumir)", async () => {
      const raw = await issueAuthToken(userId, "two_factor_login");

      await expect(findValidAuthToken(raw, "two_factor_login")).resolves.toBe(userId);
      await expect(findValidAuthToken(raw, "two_factor_login")).resolves.toBe(userId);

      const row = await prisma.authToken.findUniqueOrThrow({ where: { tokenHash: hashAuthToken(raw) } });
      expect(row.usedAt).toBeNull();
      await expect(
        prisma.$transaction((tx) => consumeAuthToken(tx, raw, "two_factor_login"))
      ).resolves.toBe(userId);
    });

    test("rechaza un token desconocido con el mensaje genérico por defecto", async () => {
      const error = await rejection(findValidAuthToken("no-existe", "two_factor_login"));

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe(INVALID_LINK_MESSAGE);
      expect(error.code).toBeUndefined();
    });

    test("rechaza uno vencido, uno usado, uno reemplazado y uno de otro tipo", async () => {
      const expired = await issueAuthToken(userId, "two_factor_reset");
      await prisma.authToken.updateMany({
        where: { tokenHash: hashAuthToken(expired) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const used = await issueAuthToken(userId, "two_factor_reset_cancel");
      await prisma.$transaction((tx) => consumeAuthToken(tx, used, "two_factor_reset_cancel"));
      const superseded = await issueAuthToken(userId, "two_factor_login");
      await issueAuthToken(userId, "two_factor_login");
      const wrongType = await issueAuthToken(userId, "password_reset");

      await expect(findValidAuthToken(expired, "two_factor_reset")).rejects.toMatchObject({ statusCode: 400 });
      await expect(findValidAuthToken(used, "two_factor_reset_cancel")).rejects.toMatchObject({ statusCode: 400 });
      await expect(findValidAuthToken(superseded, "two_factor_login")).rejects.toMatchObject({ statusCode: 400 });
      await expect(findValidAuthToken(wrongType, "two_factor_login")).rejects.toMatchObject({ statusCode: 400 });
    });

    test("con `err` el rechazo lleva el mensaje y el code indicados", async () => {
      const err = { message: "La verificación expiró", code: "TWO_FACTOR_CHALLENGE_INVALID" };
      const error = await rejection(findValidAuthToken("no-existe", "two_factor_login", err));

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("La verificación expiró");
      expect(error.code).toBe("TWO_FACTOR_CHALLENGE_INVALID");
    });
  });

  describe("consumeAuthToken() con `err`", () => {
    test("el rechazo lleva el mensaje y el code indicados", async () => {
      const err = { message: "Enlace de 2FA inválido", code: "TWO_FACTOR_LINK_INVALID" };
      const error = await rejection(
        prisma.$transaction((tx) => consumeAuthToken(tx, "no-existe", "two_factor_reset", err))
      );

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("Enlace de 2FA inválido");
      expect(error.code).toBe("TWO_FACTOR_LINK_INVALID");
    });

    test("sin `err` sigue tirando el mensaje genérico sin code", async () => {
      const error = await rejection(prisma.$transaction((tx) => consumeAuthToken(tx, "no-existe", "two_factor_reset")));

      expect(error.message).toBe(INVALID_LINK_MESSAGE);
      expect(error.code).toBeUndefined();
    });
  });

  describe("invalidateAuthTokens()", () => {
    test("marca como usados solo los tokens pendientes de los tipos pedidos", async () => {
      const login = await issueAuthToken(userId, "two_factor_login");
      const reset = await issueAuthToken(userId, "two_factor_reset");
      const cancel = await issueAuthToken(userId, "two_factor_reset_cancel");
      const verification = await issueAuthToken(userId, "email_verification");

      await invalidateAuthTokens(prisma, userId, ["two_factor_login", "two_factor_reset", "two_factor_reset_cancel"]);

      await expect(findValidAuthToken(login, "two_factor_login")).rejects.toMatchObject({ statusCode: 400 });
      await expect(findValidAuthToken(reset, "two_factor_reset")).rejects.toMatchObject({ statusCode: 400 });
      await expect(findValidAuthToken(cancel, "two_factor_reset_cancel")).rejects.toMatchObject({ statusCode: 400 });
      await expect(findValidAuthToken(verification, "email_verification")).resolves.toBe(userId);
    });

    test("no toca los tokens de otro usuario y funciona dentro de una transacción", async () => {
      const other = await prisma.user.create({
        data: { email: `auth-tokens-2fa-other-${Date.now()}@example.com`, passwordHash: "test-hash" },
      });
      try {
        const mine = await issueAuthToken(userId, "two_factor_login");
        const theirs = await issueAuthToken(other.id, "two_factor_login");

        await prisma.$transaction((tx) => invalidateAuthTokens(tx, userId, ["two_factor_login"]));

        await expect(findValidAuthToken(mine, "two_factor_login")).rejects.toMatchObject({ statusCode: 400 });
        await expect(findValidAuthToken(theirs, "two_factor_login")).resolves.toBe(other.id);
      } finally {
        await prisma.user.delete({ where: { id: other.id } });
      }
    });
  });
});
