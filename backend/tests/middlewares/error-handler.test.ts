import { Request, Response } from "express";
import { AppError } from "../../src/errors/app-error";
import { errorHandler } from "../../src/middlewares/error-handler";

function buildRes() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("errorHandler", () => {
  test("renderiza el code de un AppError junto al mensaje y los detalles", () => {
    const res = buildRes();

    errorHandler(
      new AppError(403, "Tenés que verificar tu email para hacer esto", { hint: "x" }, "EMAIL_NOT_VERIFIED"),
      {} as Request,
      res as unknown as Response,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: "Tenés que verificar tu email para hacer esto",
        code: "EMAIL_NOT_VERIFIED",
        details: { hint: "x" },
      },
    });
  });

  test("un AppError sin code no agrega la clave code al JSON", () => {
    const res = buildRes();

    errorHandler(new AppError(404, "No encontrado"), {} as Request, res as unknown as Response, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    const body = JSON.parse(JSON.stringify(res.json.mock.calls[0][0]));
    expect(body).toEqual({ error: { message: "No encontrado" } });
  });

  test("AppError sigue aceptando la firma vieja (statusCode, message, details)", () => {
    const error = new AppError(503, "Falta config", { missingEnvVars: ["X"] });

    expect(error.statusCode).toBe(503);
    expect(error.details).toEqual({ missingEnvVars: ["X"] });
    expect(error.code).toBeUndefined();
  });
});
