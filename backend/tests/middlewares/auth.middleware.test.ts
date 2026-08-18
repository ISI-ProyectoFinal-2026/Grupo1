import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { requireAuth } from "../../src/middlewares/auth.middleware";
import { AppError } from "../../src/errors/app-error";

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

    expect(() => requireAuth(req, {} as Response, next)).toThrow(AppError);
    try {
      requireAuth(req, {} as Response, next);
    } catch (error) {
      expect((error as AppError).statusCode).toBe(401);
    }
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
    const expiredToken = jwt.sign({ sub: "1", email: "a@example.com" }, process.env.JWT_SECRET!, {
      expiresIn: -1,
    });
    const req = buildReq(`Bearer ${expiredToken}`);
    const next = jest.fn();

    expect(() => requireAuth(req, {} as Response, next)).toThrow(AppError);
    try {
      requireAuth(req, {} as Response, next);
    } catch (error) {
      expect((error as AppError).statusCode).toBe(401);
    }
  });

  test("con token válido cuelga userId en req y llama a next()", () => {
    const validToken = jwt.sign({ sub: "42", email: "a@example.com" }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });
    const req = buildReq(`Bearer ${validToken}`);
    const next = jest.fn();

    requireAuth(req, {} as Response, next);

    expect(req.userId).toBe("42");
    expect(next).toHaveBeenCalledTimes(1);
  });
});
