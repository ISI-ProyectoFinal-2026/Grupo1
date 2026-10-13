import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";
import * as matchingService from "../../src/services/matching.service";

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
});
