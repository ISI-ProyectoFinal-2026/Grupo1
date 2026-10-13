import request from "supertest";

// Archivo propio para que el contador en memoria del limiter no se comparta
// con las otras suites de auth (Jest aísla los módulos por archivo).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TWO_FACTOR_RATE_LIMIT } = require("../../src/middlewares/rate-limit");

describe("POST /api/auth/2fa/login — rate limit por IP", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  // El limiter se saltea con NODE_ENV=test; se desactiva ese bypass solo acá.
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test(`responde 429 a partir de la request ${TWO_FACTOR_RATE_LIMIT + 1}`, async () => {
    // Bodies inválidos: el limiter corre antes que la validación, así que
    // cuentan igual y el test no toca la base.
    for (let i = 0; i < TWO_FACTOR_RATE_LIMIT; i += 1) {
      expect((await request(app).post("/api/auth/2fa/login").send({})).status).toBe(400);
    }

    const limited = await request(app).post("/api/auth/2fa/login").send({});

    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toBe("Demasiados intentos, esperá unos minutos");

    // El login de contraseña tiene su propio limiter: no queda bloqueado por este.
    const login = await request(app).post("/api/auth/login").send({});
    expect(login.status).toBe(400);
  });
});
