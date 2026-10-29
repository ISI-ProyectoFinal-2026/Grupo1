import request from "supertest";
import { REPORT_CREATE_RATE_LIMIT } from "../../src/middlewares/rate-limit";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";
import { TEST_IMAGE_URL, TEST_R2_PUBLIC_URL } from "../helpers/reports";

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

const validReport = {
  reportType: "lost",
  title: "Perro perdido en la plaza",
  location: { lat: -34.6, lng: -58.38 },
  imageUrl: TEST_IMAGE_URL,
};

describe("POST /api/reports — rate limit por usuario", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalR2Url = process.env.R2_PUBLIC_URL;
  // requireAuth valida el token contra la base: los usuarios tienen que existir.
  let spammerId: number;
  let spammerToken: string;
  let otherId: number;
  let otherToken: string;
  let unverifiedId: number;
  let unverifiedToken: string;

  beforeAll(async () => {
    const spammer = await createTestUser({ prefix: "rate-limit-spammer" });
    const other = await createTestUser({ prefix: "rate-limit-other" });
    spammerId = spammer.user.id;
    spammerToken = spammer.token;
    otherId = other.user.id;
    otherToken = other.token;
    const unverified = await createTestUser({ prefix: "rate-limit-unverified", verified: false });
    unverifiedId = unverified.user.id;
    unverifiedToken = unverified.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [spammerId, otherId, unverifiedId] } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    process.env.NODE_ENV = "development";
    process.env.R2_PUBLIC_URL = TEST_R2_PUBLIC_URL;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalR2Url === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = originalR2Url;
  });

  test(`responde 429 al reporte ${REPORT_CREATE_RATE_LIMIT + 1} del mismo usuario, sin bloquear a otro`, async () => {
    for (let i = 0; i < REPORT_CREATE_RATE_LIMIT; i += 1) {
      const res = await request(app).post("/api/reports").set("Authorization", `Bearer ${spammerToken}`).send(validReport);
      expect(res.status).toBe(201);
    }

    const limited = await request(app).post("/api/reports").set("Authorization", `Bearer ${spammerToken}`).send(validReport);

    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toMatch(/reportes/i);
    expect(limited.headers["ratelimit-limit"]).toBe(String(REPORT_CREATE_RATE_LIMIT));

    // El cupo es por usuario, no por IP: otro usuario detrás de la misma IP
    // (misma red, mismo NAT) sigue pudiendo publicar.
    const other = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${otherToken}`)
      .send(validReport);

    expect(other.status).toBe(201);
  });

  test("un usuario sin verificar recibe 403 siempre: el gate va antes del limiter y no gasta su cupo", async () => {
    for (let i = 0; i < REPORT_CREATE_RATE_LIMIT + 1; i += 1) {
      const res = await request(app).post("/api/reports").set("Authorization", `Bearer ${unverifiedToken}`).send(validReport);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
    }

    // Una vez verificado, el cupo está intacto: el primer reporte pasa.
    await prisma.user.update({ where: { id: unverifiedId }, data: { emailVerifiedAt: new Date() } });
    const res = await request(app).post("/api/reports").set("Authorization", `Bearer ${unverifiedToken}`).send(validReport);
    expect(res.status).toBe(201);
  });
});
