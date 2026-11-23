import request from "supertest";

// Archivo propio para que el contador en memoria del limiter no se comparta
// con otras suites (Jest aísla los módulos por archivo).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TWO_FACTOR_RATE_LIMIT } = require("../../src/middlewares/rate-limit");

describe("DELETE /api/auth/me — rate limit por IP (#366)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test(`responde 429 a partir de la request ${TWO_FACTOR_RATE_LIMIT + 1}`, async () => {
    // sin token: el limiter corre antes que requireAuth y frena el barrido de contraseñas y códigos
    for (let i = 0; i < TWO_FACTOR_RATE_LIMIT; i += 1) {
      expect((await request(app).delete("/api/auth/me").send({ password: "x" })).status).toBe(401);
    }

    const limited = await request(app).delete("/api/auth/me").send({ password: "x" });

    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toBe("Demasiados intentos, esperá unos minutos");
  });
});
