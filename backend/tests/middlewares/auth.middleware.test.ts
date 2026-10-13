import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../../src/errors/app-error";

const userFindUnique = jest.fn();

jest.mock("../../src/db/client", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => userFindUnique(...args) },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { requireAuth, optionalAuth, requireRole, requireVerifiedEmail } = require("../../src/middlewares/auth.middleware");

const originalSecret = process.env.JWT_SECRET;

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

afterAll(() => {
  process.env.JWT_SECRET = originalSecret;
});

beforeEach(() => {
  jest.resetAllMocks();
});

function signToken(payload: Record<string, unknown>, expiresIn: jwt.SignOptions["expiresIn"] = "1h"): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn });
}

function authUserRow(overrides: Record<string, unknown> = {}) {
  return { id: 42, role: "usuario_regular", emailVerifiedAt: null, tokenVersion: 0, ...overrides };
}

describe("requireAuth", () => {
  function buildReq(authHeader?: string): Request {
    return { headers: { authorization: authHeader }, userId: undefined } as unknown as Request;
  }

  test("sin header Authorization tira AppError 401", async () => {
    const req = buildReq(undefined);
    const next = jest.fn();

    await expect(requireAuth(req, {} as Response, next)).rejects.toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("con header sin prefijo Bearer tira AppError 401", async () => {
    const req = buildReq("token-sin-bearer");
    const next = jest.fn();

    await expect(requireAuth(req, {} as Response, next)).rejects.toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });

  test("con token inválido tira AppError 401 sin consultar la base", async () => {
    const req = buildReq("Bearer token-invalido");
    const next = jest.fn();

    await expect(requireAuth(req, {} as Response, next)).rejects.toThrow(
      expect.objectContaining({ statusCode: 401, message: "Token inválido" })
    );
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("con token expirado tira AppError 401 con el mensaje de expiración", async () => {
    const expiredToken = signToken({ sub: 1, email: "a@example.com" }, -1);
    const req = buildReq(`Bearer ${expiredToken}`);
    const next = jest.fn();

    await expect(requireAuth(req, {} as Response, next)).rejects.toThrow(
      expect.objectContaining({ statusCode: 401, message: "El token expiró, iniciá sesión nuevamente" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("con token válido de un usuario que ya no existe tira AppError 401", async () => {
    userFindUnique.mockResolvedValue(null);
    const req = buildReq(`Bearer ${signToken({ sub: 42, email: "a@example.com" })}`);
    const next = jest.fn();

    await expect(requireAuth(req, {} as Response, next)).rejects.toThrow(
      expect.objectContaining({ statusCode: 401, message: "Token inválido" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("con token de una versión de sesión vieja tira AppError 401", async () => {
    userFindUnique.mockResolvedValue(authUserRow({ tokenVersion: 1 }));
    const req = buildReq(`Bearer ${signToken({ sub: 42, email: "a@example.com", tv: 0 })}`);
    const next = jest.fn();

    await expect(requireAuth(req, {} as Response, next)).rejects.toThrow(
      expect.objectContaining({ statusCode: 401, message: "Tu sesión expiró, iniciá sesión de nuevo" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("un token sin `tv` se trata como versión 0", async () => {
    userFindUnique.mockResolvedValue(authUserRow({ tokenVersion: 1 }));
    const req = buildReq(`Bearer ${signToken({ sub: 42, email: "a@example.com" })}`);

    await expect(requireAuth(req, {} as Response, jest.fn())).rejects.toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  test("con token válido cuelga userId y authUser en req y llama a next()", async () => {
    const row = authUserRow({ tokenVersion: 3, role: "moderador" });
    userFindUnique.mockResolvedValue(row);
    const req = buildReq(`Bearer ${signToken({ sub: 42, email: "a@example.com", tv: 3 })}`);
    const next = jest.fn();

    await requireAuth(req, {} as Response, next);

    expect(req.userId).toBe(42);
    expect(req.authUser).toEqual(row);
    expect(next).toHaveBeenCalledTimes(1);
    expect(userFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 42 } }));
  });
});

describe("optionalAuth", () => {
  function buildReq(authHeader?: string): Request {
    return { headers: { authorization: authHeader } } as unknown as Request;
  }

  test("sin header deja pasar como visitante anónimo", async () => {
    const req = buildReq(undefined);
    const next = jest.fn();

    await optionalAuth(req, {} as Response, next);

    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("con token válido cuelga userId y authUser", async () => {
    userFindUnique.mockResolvedValue(authUserRow());
    const req = buildReq(`Bearer ${signToken({ sub: 42, email: "a@example.com" })}`);
    const next = jest.fn();

    await optionalAuth(req, {} as Response, next);

    expect(req.userId).toBe(42);
    expect(req.authUser).toEqual(authUserRow());
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("con token de sesión vieja deja pasar como anónimo", async () => {
    userFindUnique.mockResolvedValue(authUserRow({ tokenVersion: 2 }));
    const req = buildReq(`Bearer ${signToken({ sub: 42, email: "a@example.com", tv: 1 })}`);
    const next = jest.fn();

    await optionalAuth(req, {} as Response, next);

    expect(req.userId).toBeUndefined();
    expect(req.authUser).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("con token inválido deja pasar como anónimo", async () => {
    const req = buildReq("Bearer basura");
    const next = jest.fn();

    await optionalAuth(req, {} as Response, next);

    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("un error de infraestructura (no de autenticación) no se disfraza de visitante anónimo", async () => {
    userFindUnique.mockRejectedValue(new Error("db caída"));
    const req = buildReq(`Bearer ${signToken({ sub: 42, email: "a@example.com" })}`);
    const next = jest.fn();

    await expect(optionalAuth(req, {} as Response, next)).rejects.toThrow("db caída");
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  function buildReq(userId?: number, authUser?: Record<string, unknown>): Request {
    return { headers: {}, userId, authUser } as unknown as Request;
  }

  test("sin req.userId (requireAuth no corrió antes) tira AppError 401", async () => {
    const req = buildReq(undefined);
    const next = jest.fn();

    await expect(requireRole("admin")(req, {} as Response, next)).rejects.toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("si el usuario no existe en la base tira AppError 401", async () => {
    userFindUnique.mockResolvedValue(null);
    const req = buildReq(999);
    const next = jest.fn();

    await expect(requireRole("admin")(req, {} as Response, next)).rejects.toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("con rol insuficiente tira AppError 403", async () => {
    userFindUnique.mockResolvedValue({ role: "usuario_regular" });
    const req = buildReq(1);
    const next = jest.fn();

    await expect(requireRole("admin")(req, {} as Response, next)).rejects.toThrow(
      expect.objectContaining({ statusCode: 403 })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("con rol exacto permitido llama a next()", async () => {
    userFindUnique.mockResolvedValue({ role: "admin" });
    const req = buildReq(1);
    const next = jest.fn();

    await requireRole("admin")(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("con rol incluido entre varios roles permitidos llama a next()", async () => {
    userFindUnique.mockResolvedValue({ role: "moderador" });
    const req = buildReq(1);
    const next = jest.fn();

    await requireRole("moderador", "admin")(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("resuelve el rol fresco desde la base (no confía en el rol del JWT)", async () => {
    userFindUnique.mockResolvedValue({ role: "admin" });
    const req = buildReq(7);
    const next = jest.fn();

    await requireRole("admin")(req, {} as Response, next);

    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { role: true },
    });
  });

  test("reusa el rol que requireAuth ya cargó en req.authUser sin volver a consultar", async () => {
    const req = buildReq(7, authUserRow({ id: 7, role: "admin" }));
    const next = jest.fn();

    await requireRole("admin")(req, {} as Response, next);

    expect(userFindUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("con el rol de req.authUser insuficiente tira AppError 403", async () => {
    const req = buildReq(7, authUserRow({ id: 7, role: "usuario_regular" }));
    const next = jest.fn();

    await expect(requireRole("admin")(req, {} as Response, next)).rejects.toThrow(
      expect.objectContaining({ statusCode: 403 })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireVerifiedEmail", () => {
  function buildReq(authUser?: Record<string, unknown>): Request {
    return { headers: {}, authUser } as unknown as Request;
  }

  test("sin req.authUser (requireAuth no corrió antes) tira AppError 401", () => {
    const next: NextFunction = jest.fn();

    expect(() => requireVerifiedEmail(buildReq(undefined), {} as Response, next)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("con email sin verificar tira AppError 403 con code EMAIL_NOT_VERIFIED", () => {
    const next: NextFunction = jest.fn();

    expect(() => requireVerifiedEmail(buildReq(authUserRow()), {} as Response, next)).toThrow(
      expect.objectContaining({
        statusCode: 403,
        code: "EMAIL_NOT_VERIFIED",
        message: "Tenés que verificar tu email para hacer esto",
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("con email verificado llama a next()", () => {
    const next: NextFunction = jest.fn();

    requireVerifiedEmail(buildReq(authUserRow({ emailVerifiedAt: new Date() })), {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
