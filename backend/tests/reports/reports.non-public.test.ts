import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import * as matchingService from "../../src/services/matching.service";
import { NO_ANIMAL_DETECTED_MESSAGE } from "../../src/constants/moderation";
import { createTestUser } from "../helpers/users";
import { TEST_R2_PUBLIC_URL } from "../helpers/reports";

type NonPublicStatus = "pending" | "rejected" | "hidden";
const NON_PUBLIC: NonPublicStatus[] = ["pending", "rejected", "hidden"];

// reglas de reportes no públicos y flyer propio (#311)
describe("reportes no públicos", () => {
  const originalR2PublicUrl = process.env.R2_PUBLIC_URL;
  let ownerId: number;
  let ownerToken: string;
  let otherId: number;
  let otherToken: string;

  async function createReport(userId: number, status: NonPublicStatus | "published", reportType: "lost" | "found" = "lost") {
    const report = await prisma.report.create({ data: { userId, reportType, status, title: "Reporte no público #311" } });
    return report.id;
  }

  beforeAll(async () => {
    const owner = await createTestUser({ prefix: "non-public-owner" });
    ownerId = owner.user.id;
    ownerToken = owner.token;
    const other = await createTestUser({ prefix: "non-public-other" });
    otherId = other.user.id;
    otherToken = other.token;
  });

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = TEST_R2_PUBLIC_URL;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.notification.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
    await prisma.report.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
  });

  afterAll(async () => {
    if (originalR2PublicUrl === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = originalR2PublicUrl;
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await prisma.$disconnect();
  });

  describe("GET /api/reports/:id/matches", () => {
    test.each(NON_PUBLIC)("reporte %s: 404 para un tercero y 200 para el dueño", async (status) => {
      const id = await createReport(ownerId, status);
      const matches = (token: string) => request(app).get(`/api/reports/${id}/matches`).set("Authorization", `Bearer ${token}`);

      expect((await matches(otherToken)).status).toBe(404);
      expect((await matches(ownerToken)).status).toBe(200);
    });
  });

  describe("POST /api/chats", () => {
    test.each(NON_PUBLIC)("reporte %s: 404 y no crea el chat", async (status) => {
      const id = await createReport(ownerId, status);

      const res = await request(app)
        .post("/api/chats")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ reportId: id, participantId: ownerId });

      expect(res.status).toBe(404);
      expect(await prisma.chat.count({ where: { reportId: id } })).toBe(0);
    });
  });

  describe("POST /api/chats sin revelar el reporte", () => {
    test.each(NON_PUBLIC)("reporte %s con participantId ajeno al autor: 404 y no 403", async (status) => {
      const id = await createReport(ownerId, status);

      const res = await request(app)
        .post("/api/chats")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ reportId: id, participantId: otherId + 100000 });

      expect(res.status).toBe(404);
    });

    test("el chat ya abierto de un reporte que pasó a oculto se sigue devolviendo", async () => {
      const id = await createReport(ownerId, "hidden");
      const [userAId, userBId] = ownerId < otherId ? [ownerId, otherId] : [otherId, ownerId];
      const chat = await prisma.chat.create({ data: { userAId, userBId, reportId: id } });

      const res = await request(app)
        .post("/api/chats")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ reportId: id, participantId: ownerId });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(chat.id);
    });
  });

  describe("PUT /api/reports/:id/flyer/custom", () => {
    const flyerUrl = `${TEST_R2_PUBLIC_URL}/flyers/mi-flyer.png`;
    const putFlyer = (id: number) =>
      request(app).put(`/api/reports/${id}/flyer/custom`).set("Authorization", `Bearer ${ownerToken}`).send({ flyerUrl });

    test("reporte oculto: 409 y no guarda el flyer", async () => {
      const id = await createReport(ownerId, "hidden");
      jest.spyOn(matchingService, "analyzeImage").mockResolvedValue("animal");

      const res = await putFlyer(id);

      expect(res.status).toBe(409);
      expect((await prisma.report.findUnique({ where: { id } }))?.customFlyerUrl).toBeNull();
    });

    test("imagen sin animal: 422 con el mensaje de la foto principal y no guarda el flyer", async () => {
      const id = await createReport(ownerId, "published");
      const analyzeSpy = jest.spyOn(matchingService, "analyzeImage").mockResolvedValue("no_animal");

      const res = await putFlyer(id);

      expect(res.status).toBe(422);
      expect(res.body.error.message).toBe(NO_ANIMAL_DETECTED_MESSAGE);
      expect(analyzeSpy).toHaveBeenCalledWith(flyerUrl);
      expect((await prisma.report.findUnique({ where: { id } }))?.customFlyerUrl).toBeNull();
    });

    test("imagen con animal: 200 y guarda el flyer", async () => {
      const id = await createReport(ownerId, "published");
      jest.spyOn(matchingService, "analyzeImage").mockResolvedValue("animal");

      const res = await putFlyer(id);

      expect(res.status).toBe(200);
      expect(res.body.customFlyerUrl).toBe(flyerUrl);
    });

    test("si se oculta entre la lectura y el bloqueo: 409 y no guarda el flyer", async () => {
      const id = await createReport(ownerId, "published");
      jest.spyOn(matchingService, "analyzeImage").mockResolvedValue("animal");
      const original = prisma.$transaction.bind(prisma) as (...args: unknown[]) => Promise<unknown>;
      // ocultamiento concurrente justo antes de tomar el lock
      jest.spyOn(prisma, "$transaction").mockImplementationOnce((async (...args: unknown[]) => {
        await prisma.report.update({ where: { id }, data: { status: "hidden" } });
        return original(...args);
      }) as never);

      const res = await putFlyer(id);

      expect(res.status).toBe(409);
      expect((await prisma.report.findUnique({ where: { id } }))?.customFlyerUrl).toBeNull();
    });

    test("la IA corre antes de tomar el lock", async () => {
      const id = await createReport(ownerId, "published");
      const calls: string[] = [];
      jest.spyOn(matchingService, "analyzeImage").mockImplementation(async () => {
        calls.push("ia");
        return "animal";
      });
      const original = prisma.$transaction.bind(prisma) as (...args: unknown[]) => Promise<unknown>;
      jest.spyOn(prisma, "$transaction").mockImplementationOnce((async (...args: unknown[]) => {
        calls.push("tx");
        return original(...args);
      }) as never);

      expect((await putFlyer(id)).status).toBe(200);
      expect(calls).toEqual(["ia", "tx"]);
    });

    test("IA no disponible: 200 y guarda el flyer (fail-open)", async () => {
      const id = await createReport(ownerId, "published");
      jest.spyOn(matchingService, "analyzeImage").mockResolvedValue("unavailable");

      const res = await putFlyer(id);

      expect(res.status).toBe(200);
      expect(res.body.customFlyerUrl).toBe(flyerUrl);
    });
  });

  describe("POST /api/reports/:id/matches/:matchId/confirm", () => {
    test.each(NON_PUBLIC)("reporte propio %s: 409 y sin aviso a la otra parte", async (status) => {
      const lostId = await createReport(ownerId, status, "lost");
      const foundId = await createReport(otherId, "published", "found");
      const match = await prisma.reportMatch.create({
        data: { reportLostId: lostId, reportFoundId: foundId, similarityScore: 0.9 },
      });

      const res = await request(app)
        .post(`/api/reports/${lostId}/matches/${match.id}/confirm`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(409);
      expect((await prisma.reportMatch.findUnique({ where: { id: match.id } }))?.status).toBe("pending");
      expect(await prisma.notification.count({ where: { userId: otherId } })).toBe(0);
    });
  });
});
