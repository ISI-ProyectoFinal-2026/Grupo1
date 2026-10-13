import request from "supertest";

// Archivo propio: el contador en memoria del limiter es por módulo y por IP, y
// las rutas de segundo factor lo comparten.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TWO_FACTOR_RATE_LIMIT } = require("../../src/middlewares/rate-limit");

describe("rate limit por IP en activar, desactivar y regenerar códigos", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const limitedPaths = ["enable", "disable", "recovery-codes"];

  // El limiter se saltea con NODE_ENV=test; se desactiva ese bypass solo acá.
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test("las tres rutas comparten el cupo y la request siguiente responde 429", async () => {
    // Sin sesión: el limiter corre antes de requireAuth, así que estas requests
    // cuentan igual (401) y el test no toca la base.
    for (let i = 0; i < TWO_FACTOR_RATE_LIMIT; i += 1) {
      const path = limitedPaths[i % limitedPaths.length];
      expect((await request(app).post(`/api/auth/2fa/${path}`).send({})).status).toBe(401);
    }

    for (const path of limitedPaths) {
      const limited = await request(app).post(`/api/auth/2fa/${path}`).send({});
      expect(limited.status).toBe(429);
      expect(limited.body.error.message).toBe("Demasiados intentos, esperá unos minutos");
    }
  });

  test("consultar el estado no consume ese cupo", async () => {
    const status = await request(app).get("/api/auth/2fa/status");

    expect(status.status).toBe(401);
  });
});
