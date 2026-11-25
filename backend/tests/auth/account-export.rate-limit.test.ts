import request from "supertest";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";

// Archivo propio para que el contador en memoria del limiter no se comparta
// con otras suites (Jest aísla los módulos por archivo).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ACCOUNT_EXPORT_RATE_LIMIT } = require("../../src/middlewares/rate-limit");

describe("GET /api/auth/me/export — rate limit por usuario (#366)", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const userIds: number[] = [];

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  const exportFor = (token: string) => request(app).get("/api/auth/me/export").set("Authorization", `Bearer ${token}`);

  test(`responde 429 a la exportación ${ACCOUNT_EXPORT_RATE_LIMIT + 1} del mismo usuario, sin bloquear a otro`, async () => {
    const heavy = await createTestUser({ prefix: "export-limit-heavy" });
    const other = await createTestUser({ prefix: "export-limit-other" });
    userIds.push(heavy.user.id, other.user.id);

    for (let i = 0; i < ACCOUNT_EXPORT_RATE_LIMIT; i += 1) {
      expect((await exportFor(heavy.token)).status).toBe(200);
    }

    const limited = await exportFor(heavy.token);
    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toMatch(/exportaci/i);

    // el cupo es por usuario, no por IP
    expect((await exportFor(other.token)).status).toBe(200);
  });

  test("sin token responde 401 y no gasta cupo: el limiter va después de requireAuth", async () => {
    for (let i = 0; i < ACCOUNT_EXPORT_RATE_LIMIT + 1; i += 1) {
      expect((await request(app).get("/api/auth/me/export")).status).toBe(401);
    }
  });
});
