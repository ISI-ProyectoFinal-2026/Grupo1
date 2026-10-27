import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";
import * as matchingService from "../../src/services/matching.service";

describe("POST /api/uploads/analyze", () => {
  const originalEnv = { ...process.env };
  let analyzeSpy: jest.SpyInstance;
  // requireAuth valida el token contra la base: el usuario tiene que existir.
  let userId: number;
  let token: string;

  beforeAll(async () => {
    const created = await createTestUser({ prefix: "uploads-analyze-test" });
    userId = created.user.id;
    token = created.token;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    analyzeSpy = jest.spyOn(matchingService, "analyzeImage");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  function analyze(body: unknown) {
    return request(app).post("/api/uploads/analyze").set("Authorization", `Bearer ${token}`).send(body as object);
  }

  test("responds 401 without an auth token", async () => {
    const res = await request(app).post("/api/uploads/analyze").send({ imageUrl: "https://pub-test.r2.dev/pets/dog.jpg" });

    expect(res.status).toBe(401);
    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  test("responds 400 when imageUrl is missing or not an http(s) URL", async () => {
    expect((await analyze({})).status).toBe(400);
    expect((await analyze({ imageUrl: "javascript:alert(1)" })).status).toBe(400);
    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  // Otherwise any logged-in user could make the AI service fetch arbitrary URLs
  // and read their reachability from the answer (SSRF oracle).
  test.each([
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:8000/health",
    "https://pub-test.r2.dev.evil.com/pets/dog.jpg",
    "https://evil.com/dog.jpg",
    // httpx lee el host evil.com en estas dos (#229)
    "https://pub-test.r2.dev\\@evil.com/pets/dog.jpg",
    "https://evil.com@pub-test.r2.dev/pets/dog.jpg",
  ])("responds 400 for an image URL outside the R2 public bucket: %s", async (imageUrl) => {
    const res = await analyze({ imageUrl });

    expect(res.status).toBe(400);
    expect(analyzeSpy).not.toHaveBeenCalled();
  });

  test("forwards the normalized URL to the AI service", async () => {
    analyzeSpy.mockResolvedValue("animal");

    const res = await analyze({ imageUrl: "HTTPS://PUB-TEST.r2.dev/pets/dog.jpg" });

    expect(res.status).toBe(200);
    expect(analyzeSpy).toHaveBeenCalledWith("https://pub-test.r2.dev/pets/dog.jpg");
  });

  test("responds hasAnimal=true for an image with an animal", async () => {
    analyzeSpy.mockResolvedValue("animal");

    const res = await analyze({ imageUrl: "https://pub-test.r2.dev/pets/dog.jpg" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasAnimal: true });
    expect(analyzeSpy).toHaveBeenCalledWith("https://pub-test.r2.dev/pets/dog.jpg");
  });

  // The frontend shows this message as-is, so the wording lives only in the backend.
  test("responds hasAnimal=false with the SPAM message for an image without animals", async () => {
    analyzeSpy.mockResolvedValue("no_animal");

    const res = await analyze({ imageUrl: "https://pub-test.r2.dev/pets/landscape.jpg" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      hasAnimal: false,
      message: "Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM",
    });
  });

  test("responds hasAnimal=null when the analysis is unavailable", async () => {
    analyzeSpy.mockResolvedValue("unavailable");

    const res = await analyze({ imageUrl: "https://pub-test.r2.dev/pets/dog.jpg" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasAnimal: null });
  });
});
