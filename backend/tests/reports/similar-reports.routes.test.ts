import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";
import * as similarReportsService from "../../src/services/similar-reports.service";

describe("POST /api/reports/similar", () => {
  const originalEnv = { ...process.env };
  let findSpy: jest.SpyInstance;
  let userId: number;
  let token: string;
  const body = { reportType: "found", location: { lat: -34.6, lng: -58.38 } };

  beforeAll(async () => {
    const created = await createTestUser({ prefix: "similar-reports-routes" });
    userId = created.user.id;
    token = created.token;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    findSpy = jest.spyOn(similarReportsService, "findSimilarReports").mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  const post = (payload: unknown) =>
    request(app).post("/api/reports/similar").set("Authorization", `Bearer ${token}`).send(payload as object);

  test("responde 401 sin sesión", async () => {
    const res = await request(app).post("/api/reports/similar").send(body);

    expect(res.status).toBe(401);
    expect(findSpy).not.toHaveBeenCalled();
  });

  test("responde 403 si el email no está verificado", async () => {
    const unverified = await createTestUser({ prefix: "similar-reports-unverified", verified: false });
    try {
      const res = await request(app)
        .post("/api/reports/similar")
        .set("Authorization", `Bearer ${unverified.token}`)
        .send(body);

      expect(res.status).toBe(403);
      expect(findSpy).not.toHaveBeenCalled();
    } finally {
      await prisma.user.delete({ where: { id: unverified.user.id } });
    }
  });

  test.each([
    ["tipo inválido", { ...body, reportType: "adopted" }],
    ["sin ubicación", { reportType: "found" }],
    ["latitud fuera de rango", { ...body, location: { lat: 91, lng: 0 } }],
    ["longitud fuera de rango", { ...body, location: { lat: 0, lng: -181 } }],
  ])("responde 400 con %s", async (_case, payload) => {
    const res = await post(payload);

    expect(res.status).toBe(400);
    expect(findSpy).not.toHaveBeenCalled();
  });

  test.each([
    "https://evil.com/dog.jpg",
    "http://169.254.169.254/latest/meta-data/",
    "https://evil.com@pub-test.r2.dev/pets/dog.jpg",
  ])("responde 400 con una imagen fuera del bucket R2: %s", async (imageUrl) => {
    const res = await post({ ...body, imageUrl });

    expect(res.status).toBe(400);
    expect(findSpy).not.toHaveBeenCalled();
  });

  test("busca con la URL R2 normalizada y el usuario de la sesión", async () => {
    const item = {
      id: 9,
      title: "Perro encontrado",
      reportType: "found",
      status: "published",
      imageUrl: null,
      distanceMeters: 120,
      similarity: null,
      isOwn: false,
    };
    findSpy.mockResolvedValue([item]);

    const res = await post({ ...body, imageUrl: "HTTPS://PUB-TEST.r2.dev/pets/dog.jpg" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([item]);
    expect(findSpy).toHaveBeenCalledWith(
      { ...body, imageUrl: "https://pub-test.r2.dev/pets/dog.jpg" },
      userId
    );
  });
});
