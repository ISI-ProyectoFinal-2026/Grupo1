import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../../src/errors/app-error";

const userFindUnique = jest.fn();

jest.mock("../../src/db/client", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => userFindUnique(...args) },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { requireAuth, requireRole } = require("../../src/middlewares/auth.middleware");

describe("requireAuth", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  function buildReq(authHeader?: string): Request {
    return { headers: { authorization: authHeader }, userId: undefined } as unknown as Request;
  }

  test("sin header Authorization tira AppError 401", () => {
    const req = buildReq(undefined);
    const next = jest.fn();

    expect(() => requireAuth(req, {} as Response, next)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("con header sin prefijo Bearer tira AppError 401", () => {
    const req = buildReq("token-sin-bearer");
    const next = jest.fn();

    expect(() => requireAuth(req, {} as Response, next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });

  test("con token inválido tira AppError 401", () => {
    const req = buildReq("Bearer token-invalido");
    const next = jest.fn();

    expect(() => requireAuth(req, {} as Response, next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });

  test("con token expirado tira AppError 401", () => {
    const expiredToken = jwt.sign({ sub: 1, email: "a@example.com" }, process.env.JWT_SECRET!, {
      expiresIn: -1,
    });
    const req = buildReq(`Bearer ${expiredToken}`);
    const next = jest.fn();

    expect(() => requireAuth(req, {} as Response, next)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("con token válido cuelga userId en req y llama a next()", () => {
    const validToken = jwt.sign({ sub: 42, email: "a@example.com" }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });
    const req = buildReq(`Bearer ${validToken}`);
    const next = jest.fn();

    requireAuth(req, {} as Response, next);

    expect(req.userId).toBe(42);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("requireRole", () => {
  function buildReq(userId?: number): Request {
    return { headers: {}, userId } as unknown as Request;
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

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
});
