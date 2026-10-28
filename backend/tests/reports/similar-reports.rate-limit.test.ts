import request from "supertest";
import { SIMILAR_REPORTS_RATE_LIMIT } from "../../src/middlewares/rate-limit";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";

jest.mock("../../src/services/similar-reports.service", () => ({
  findSimilarReports: jest.fn(async () => []),
}));

// archivo propio: el contador en memoria del limiter no se comparte con otras suites
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require("../../src/app");

const body = { reportType: "lost", location: { lat: -34.6, lng: -58.38 } };

describe("POST /api/reports/similar — rate limit por usuario", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let firstId: number;
  let firstToken: string;
  let secondId: number;
  let secondToken: string;

  beforeAll(async () => {
    const first = await createTestUser({ prefix: "similar-limit-first" });
    const second = await createTestUser({ prefix: "similar-limit-second" });
    firstId = first.user.id;
    firstToken = first.token;
    secondId = second.user.id;
    secondToken = second.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [firstId, secondId] } } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  const post = (token: string) =>
    request(app).post("/api/reports/similar").set("Authorization", `Bearer ${token}`).send(body);

  test("corta con 429 al superar el cupo, sin afectar a otro usuario", async () => {
    for (let i = 0; i < SIMILAR_REPORTS_RATE_LIMIT; i++) {
      expect((await post(firstToken)).status).toBe(200);
    }

    expect((await post(firstToken)).status).toBe(429);
    expect((await post(secondToken)).status).toBe(200);
  });
});
