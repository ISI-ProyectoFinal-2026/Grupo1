import request from "supertest";
import { AppError } from "../../src/errors/app-error";

// Este archivo prueba solo el limiter: la búsqueda del reporte se mockea para
// no depender de la base ni de R2. El limiter corre antes del controller, así
// que un 404 también consume cupo.
jest.mock("../../src/services/reports.service", () => {
  const actual = jest.requireActual("../../src/services/reports.service");
  return {
    ...actual,
    getVisibleById: jest.fn(async () => {
      throw new AppError(404, "Reporte no encontrado");
    }),
  };
});

// Archivo propio para que el contador en memoria del limiter no se comparta
// con las otras suites de flyer (Jest aísla los módulos por archivo).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");

const FLYER_RATE_LIMIT = 20;

describe("GET /api/reports/:id/flyer — rate limit", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  // El limiter se saltea con NODE_ENV=test (mismo patrón que uploads/auth);
  // se desactiva ese bypass solo mientras corren estos tests.
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test(`responde 429 a partir de la request ${FLYER_RATE_LIMIT + 1} dentro de la misma ventana`, async () => {
    for (let i = 0; i < FLYER_RATE_LIMIT; i += 1) {
      const res = await request(app).get("/api/reports/1/flyer");
      expect(res.status).toBe(404);
    }

    const limited = await request(app).get("/api/reports/1/flyer");

    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toMatch(/flyer/i);
    expect(limited.headers["ratelimit-limit"]).toBe(String(FLYER_RATE_LIMIT));

    // Con el cupo del flyer agotado, el detalle del reporte (misma IP, mismo
    // prefijo de ruta) no queda bloqueado: el limiter es solo del flyer y no
    // se extiende a todo /api/reports.
    const detail = await request(app).get("/api/reports/1");

    expect(detail.status).not.toBe(429);
    expect(detail.status).toBe(404);
  });
});
