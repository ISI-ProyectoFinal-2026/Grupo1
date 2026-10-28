import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";
import * as matchingService from "../../src/services/matching.service";
import { createPublishedReport, mockImageModeration, TEST_IMAGE_URL } from "../helpers/reports";

describe("/api/reports image screening", () => {
  // requireAuth valida el token contra la base: el usuario tiene que existir.
  let userId: number;
  let token: string;

  const originalEnv = { ...process.env };

  beforeAll(async () => {
    const created = await createTestUser({ prefix: "reports-screening-test" });
    userId = created.user.id;
    token = created.token;
  });

  afterAll(async () => {
    await prisma.report.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test("responds 422 with the SPAM message and creates nothing when the image has no animal", async () => {
    jest.spyOn(matchingService, "analyzeImage").mockResolvedValue("no_animal");
    const transactionSpy = jest.spyOn(prisma, "$transaction");

    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reportType: "found",
        title: "Paisaje",
        location: { lat: -34.6, lng: -58.38 },
        imageUrl: "https://pub-test.r2.dev/pets/landscape.jpg",
      });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe(
      "Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM"
    );
    expect(transactionSpy).not.toHaveBeenCalled();
  });

  test("PUT responds 422 and updates nothing when the new image has no animal", async () => {
    jest.spyOn(matchingService, "analyzeImage").mockResolvedValue("no_animal");
    jest.spyOn(prisma, "$queryRaw").mockResolvedValue([
      {
        id: 5,
        userId,
        petId: null,
        reportType: "lost",
        status: "published",
        title: "Perro perdido",
        description: null,
        imageUrl: "https://pub-test.r2.dev/pets/dog.jpg",
        customFlyerUrl: null,
        locationAddress: null,
        lat: -34.6,
        lng: -58.38,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: new Date(),
      },
    ] as never);
    const transactionSpy = jest.spyOn(prisma, "$transaction");

    const res = await request(app)
      .put("/api/reports/5")
      // The token's user is the report owner: update() compares it with the owner id.
      .set("Authorization", `Bearer ${token}`)
      .send({ imageUrl: "https://pub-test.r2.dev/pets/landscape.jpg" });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe(
      "Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM"
    );
    expect(transactionSpy).not.toHaveBeenCalled();
  });

  // fuera del bucket R2 no se persiste ni se le pide nada a la IA
  describe("image URL vs the R2 bucket (#229)", () => {
    const outsideBucket = [
      "http://169.254.169.254/latest/meta-data/",
      "https://pub-test.r2.dev.evil.com/pets/dog.jpg",
      "https://evil.com/dog.jpg",
      "https://pub-test.r2.dev\\@evil.com/pets/dog.jpg",
      "https://evil.com@pub-test.r2.dev/pets/dog.jpg",
    ];

    // reporte ya publicado con foto del bucket; los mocks de creación se descartan para no contaminar los asserts
    async function createStoredReport() {
      mockImageModeration();
      const report = await createPublishedReport(token, {
        reportType: "lost",
        title: "Perro perdido",
        location: { lat: -34.6, lng: -58.38 },
      });
      jest.restoreAllMocks();
      return report;
    }

    test("POST stores and screens the normalized URL", async () => {
      const analyzeSpy = jest.spyOn(matchingService, "analyzeImage").mockResolvedValue("animal");
      const moderationSpy = jest.spyOn(matchingService, "triggerEmbeddingGeneration").mockResolvedValue();

      const res = await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${token}`)
        .send({
          reportType: "lost",
          title: "Perro perdido",
          location: { lat: -34.6, lng: -58.38 },
          imageUrl: "HTTPS://PUB-TEST.r2.dev/pets/dog.jpg",
        });

      expect(res.status).toBe(201);
      expect(analyzeSpy).toHaveBeenCalledWith("https://pub-test.r2.dev/pets/dog.jpg");
      expect(moderationSpy).toHaveBeenCalledWith(res.body.id, "https://pub-test.r2.dev/pets/dog.jpg");
      const stored = await prisma.report.findUnique({ where: { id: res.body.id } });
      expect(stored?.imageUrl).toBe("https://pub-test.r2.dev/pets/dog.jpg");
    });

    test.each(outsideBucket)("POST responds 400 and creates nothing for %s", async (imageUrl) => {
      const analyzeSpy = jest.spyOn(matchingService, "analyzeImage");

      const res = await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${token}`)
        .send({ reportType: "lost", title: "Perro perdido", location: { lat: -34.6, lng: -58.38 }, imageUrl });

      expect(res.status).toBe(400);
      expect(analyzeSpy).not.toHaveBeenCalled();
      expect(await prisma.report.findFirst({ where: { userId, imageUrl } })).toBeNull();
    });

    test.each(outsideBucket)("PUT responds 400 and keeps the report unchanged for %s", async (imageUrl) => {
      const created = await createStoredReport();
      const analyzeSpy = jest.spyOn(matchingService, "analyzeImage");

      const res = await request(app)
        .put(`/api/reports/${created.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ imageUrl });

      expect(res.status).toBe(400);
      expect(analyzeSpy).not.toHaveBeenCalled();
      const stored = await prisma.report.findUnique({ where: { id: created.id } });
      expect(stored).toMatchObject({ imageUrl: TEST_IMAGE_URL, status: "published" });
    });

    test("PUT with an in-bucket image still re-moderates the report", async () => {
      const created = await createStoredReport();
      const analyzeSpy = jest.spyOn(matchingService, "analyzeImage").mockResolvedValue("animal");
      jest.spyOn(matchingService, "triggerEmbeddingGeneration").mockResolvedValue();

      const res = await request(app)
        .put(`/api/reports/${created.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ imageUrl: "https://pub-test.r2.dev/pets/dog.jpg" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ imageUrl: "https://pub-test.r2.dev/pets/dog.jpg", status: "pending" });
      expect(analyzeSpy).toHaveBeenCalledWith("https://pub-test.r2.dev/pets/dog.jpg");
    });

    // cambio incompatible aceptado: reenviar una URL externa ya guardada también es 400
    test("PUT resending a stored external image responds 400", async () => {
      const created = await createStoredReport();
      await prisma.report.update({ where: { id: created.id }, data: { imageUrl: "https://evil.com/dog.jpg" } });

      const res = await request(app)
        .put(`/api/reports/${created.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Perro perdido en Palermo", imageUrl: "https://evil.com/dog.jpg" });

      expect(res.status).toBe(400);
      const stored = await prisma.report.findUnique({ where: { id: created.id } });
      expect(stored?.title).toBe("Perro perdido");
    });
  });
});
