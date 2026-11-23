import request from "supertest";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";

// Archivo propio para que el contador en memoria del limiter no se comparta
// con otras suites (Jest aísla los módulos por archivo).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PROFILE_UPDATE_RATE_LIMIT } = require("../../src/middlewares/rate-limit");

describe("PATCH /api/auth/me — rate limit por usuario (#366)", () => {
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

  const patchFor = (token: string) =>
    request(app).patch("/api/auth/me").set("Authorization", `Bearer ${token}`).send({ fullName: "Ana" });

  test(`responde 429 a la edición ${PROFILE_UPDATE_RATE_LIMIT + 1} del mismo usuario, sin bloquear a otro`, async () => {
    const heavy = await createTestUser({ prefix: "profile-limit-heavy" });
    const other = await createTestUser({ prefix: "profile-limit-other" });
    userIds.push(heavy.user.id, other.user.id);

    for (let i = 0; i < PROFILE_UPDATE_RATE_LIMIT; i += 1) {
      expect((await patchFor(heavy.token)).status).toBe(200);
    }

    const limited = await patchFor(heavy.token);
    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toMatch(/perfil/i);

    // el cupo es por usuario, no por IP
    expect((await patchFor(other.token)).status).toBe(200);
  });

  test("no comparte cupo con los endpoints de cuenta que mandan mails", async () => {
    const user = await createTestUser({ prefix: "profile-limit-shared" });
    userIds.push(user.user.id);

    // el limiter de cuenta (por IP) es de 10 cada 15 minutos
    for (let i = 0; i < 11; i += 1) {
      await request(app).post("/api/auth/forgot-password").send({ email: "nadie@example.com" });
    }
    expect((await patchFor(user.token)).status).toBe(200);
  });

  test("sin token responde 401 y no gasta cupo: el limiter va después de requireAuth", async () => {
    for (let i = 0; i < PROFILE_UPDATE_RATE_LIMIT + 1; i += 1) {
      expect((await request(app).patch("/api/auth/me").send({ fullName: "Ana" })).status).toBe(401);
    }
  });
});
