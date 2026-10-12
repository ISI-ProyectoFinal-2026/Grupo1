import request from "supertest";
import { GLOBAL_RATE_LIMIT } from "../../src/middlewares/rate-limit";

// Archivo propio para que el contador en memoria del limiter no se comparta
// con otras suites (Jest aísla los módulos por archivo).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");

describe("rate limit global de /api", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  // Los limiters se saltean con NODE_ENV=test; se desactiva ese bypass solo
  // mientras corren estos tests.
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test(`responde 429 a partir de la request ${GLOBAL_RATE_LIMIT + 1} y deja /health afuera`, async () => {
    // Una ruta inexistente es lo más barato: no toca la base, pero pasa por el
    // limiter igual que cualquier endpoint real de /api.
    for (let i = 0; i < GLOBAL_RATE_LIMIT; i += 1) {
      const res = await request(app).get("/api/ruta-inexistente");
      expect(res.status).toBe(404);
    }

    const limited = await request(app).get("/api/ruta-inexistente");

    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toMatch(/demasiadas solicitudes/i);
    expect(limited.headers["ratelimit-limit"]).toBe(String(GLOBAL_RATE_LIMIT));

    // Las sondas de liveness no pueden quedar bloqueadas por el tráfico de la API.
    const health = await request(app).get("/health");

    expect(health.status).toBe(200);
  });
});
