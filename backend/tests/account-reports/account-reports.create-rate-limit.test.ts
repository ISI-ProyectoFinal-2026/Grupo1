import request from "supertest";
import { ACCOUNT_REPORT_CREATE_RATE_LIMIT } from "../../src/middlewares/rate-limit";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";

// Este archivo prueba solo el limiter de denuncias de cuentas: el service se
// mockea para no depender del umbral ni de las sanciones.
jest.mock("../../src/services/account-reports.service", () => {
  const actual = jest.requireActual("../../src/services/account-reports.service");
  return {
    ...actual,
    create: jest.fn(async (reporterId: number) => ({ id: 1, reporterId, reportedUserId: 1, severity: "mild" })),
  };
});

// Archivo propio para que el contador en memoria del limiter no se comparta
// con otras suites (Jest aísla los módulos por archivo).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");

describe("POST /api/account-reports — rate limit por usuario (#38)", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const userIds: number[] = [];
  let spammerToken: string;
  let otherToken: string;
  let unverifiedToken: string;
  let unverifiedId: number;

  beforeAll(async () => {
    const spammer = await createTestUser({ prefix: "account-report-limit-spammer" });
    const other = await createTestUser({ prefix: "account-report-limit-other" });
    const unverified = await createTestUser({ prefix: "account-report-limit-unverified", verified: false });
    userIds.push(spammer.user.id, other.user.id, unverified.user.id);
    spammerToken = spammer.token;
    otherToken = other.token;
    unverifiedToken = unverified.token;
    unverifiedId = unverified.user.id;
  });

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

  function report(token: string) {
    return request(app)
      .post("/api/account-reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ reportedUserId: 1, severity: "mild" });
  }

  test(`responde 429 a la denuncia ${ACCOUNT_REPORT_CREATE_RATE_LIMIT + 1} del mismo usuario, sin bloquear a otro`, async () => {
    for (let i = 0; i < ACCOUNT_REPORT_CREATE_RATE_LIMIT; i += 1) {
      const res = await report(spammerToken);
      expect(res.status).toBe(201);
    }

    const limited = await report(spammerToken);

    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toMatch(/denuncias/i);
    expect(limited.headers["ratelimit-limit"]).toBe(String(ACCOUNT_REPORT_CREATE_RATE_LIMIT));

    // El cupo es por usuario, no por IP.
    const other = await report(otherToken);
    expect(other.status).toBe(201);
  });

  test("un usuario sin verificar recibe 403 siempre: el gate va antes del limiter y no gasta su cupo", async () => {
    for (let i = 0; i < ACCOUNT_REPORT_CREATE_RATE_LIMIT + 1; i += 1) {
      const res = await report(unverifiedToken);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
    }

    await prisma.user.update({ where: { id: unverifiedId }, data: { emailVerifiedAt: new Date() } });
    const res = await report(unverifiedToken);
    expect(res.status).toBe(201);
  });
});
