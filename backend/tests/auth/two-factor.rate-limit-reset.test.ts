import request from "supertest";

// Archivo propio: el contador en memoria del limiter es por módulo y por IP, y
// los endpoints de reinicio lo comparten con el resto de los de cuenta.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");

const ACCOUNT_RATE_LIMIT = 10;

describe("rate limit por IP en el reinicio de 2FA", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const resetPaths = ["request", "confirm", "cancel"];

  // El limiter se saltea con NODE_ENV=test; se desactiva ese bypass solo acá.
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test("pedir, confirmar y cancelar comparten el cupo de cuenta y la request siguiente responde 429", async () => {
    // Bodies inválidos: el limiter corre antes que la validación, así que
    // cuentan igual y el test no toca la base ni manda mails.
    for (let i = 0; i < ACCOUNT_RATE_LIMIT; i += 1) {
      const path = resetPaths[i % resetPaths.length];
      expect((await request(app).post(`/api/auth/2fa/reset/${path}`).send({})).status).toBe(400);
    }

    for (const path of resetPaths) {
      const limited = await request(app).post(`/api/auth/2fa/reset/${path}`).send({});
      expect(limited.status).toBe(429);
      expect(limited.body.error.message).toBe("Demasiados intentos, esperá unos minutos");
    }

    // El login de segundo factor tiene su propio limiter: no queda bloqueado por este.
    const secondFactor = await request(app).post("/api/auth/2fa/login").send({});
    expect(secondFactor.status).toBe(400);
  });
});
