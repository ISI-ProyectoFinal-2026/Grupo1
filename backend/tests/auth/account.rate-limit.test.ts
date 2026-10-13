import request from "supertest";

// Archivo propio para que el contador en memoria del limiter no se comparta
// con las otras suites de auth (Jest aísla los módulos por archivo).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");

const ACCOUNT_RATE_LIMIT = 10;

describe("endpoints de cuenta de /api/auth — rate limit", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  // El limiter se saltea con NODE_ENV=test; se desactiva ese bypass solo acá.
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test(`responde 429 a partir de la request ${ACCOUNT_RATE_LIMIT + 1}, con el cupo compartido entre endpoints`, async () => {
    // Bodies inválidos: el limiter corre antes que la validación, así que
    // cuentan igual y el test no toca la base ni manda mails.
    for (let i = 0; i < ACCOUNT_RATE_LIMIT / 2; i += 1) {
      expect((await request(app).post("/api/auth/verify-email").send({})).status).toBe(400);
      expect((await request(app).post("/api/auth/reset-password").send({})).status).toBe(400);
    }

    const limited = await request(app).post("/api/auth/forgot-password").send({});

    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toBe("Demasiados intentos, esperá unos minutos");

    // El login tiene su propio limiter: no queda bloqueado por este.
    const login = await request(app).post("/api/auth/login").send({});
    expect(login.status).toBe(400);
  });
});
