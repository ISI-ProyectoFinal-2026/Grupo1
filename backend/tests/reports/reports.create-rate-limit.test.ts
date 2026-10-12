import request from "supertest";
import jwt from "jsonwebtoken";
import { REPORT_CREATE_RATE_LIMIT } from "../../src/middlewares/rate-limit";

// Este archivo prueba solo el limiter de creación: el service se mockea para
// no depender de la base, R2 ni el Backend IA.
jest.mock("../../src/services/reports.service", () => {
  const actual = jest.requireActual("../../src/services/reports.service");
  return {
    ...actual,
    create: jest.fn(async (data: { userId: number }) => ({ id: 1, userId: data.userId, status: "published" })),
  };
});

// Archivo propio para que el contador en memoria del limiter no se comparta
// con otras suites (Jest aísla los módulos por archivo).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");

const tokenFor = (userId: number) =>
  jwt.sign({ sub: userId, email: `rate-limit-${userId}@example.com` }, process.env.JWT_SECRET!, { expiresIn: "1h" });

const validReport = {
  reportType: "lost",
  title: "Perro perdido en la plaza",
  location: { lat: -34.6, lng: -58.38 },
};

describe("POST /api/reports — rate limit por usuario", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  test(`responde 429 al reporte ${REPORT_CREATE_RATE_LIMIT + 1} del mismo usuario, sin bloquear a otro`, async () => {
    const spammer = tokenFor(101);

    for (let i = 0; i < REPORT_CREATE_RATE_LIMIT; i += 1) {
      const res = await request(app).post("/api/reports").set("Authorization", `Bearer ${spammer}`).send(validReport);
      expect(res.status).toBe(201);
    }

    const limited = await request(app).post("/api/reports").set("Authorization", `Bearer ${spammer}`).send(validReport);

    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toMatch(/reportes/i);
    expect(limited.headers["ratelimit-limit"]).toBe(String(REPORT_CREATE_RATE_LIMIT));

    // El cupo es por usuario, no por IP: otro usuario detrás de la misma IP
    // (misma red, mismo NAT) sigue pudiendo publicar.
    const other = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${tokenFor(202)}`)
      .send(validReport);

    expect(other.status).toBe(201);
  });
});
