import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

describe("POST /api/reports/:id/flags", () => {
  let userId: number;
  let reporterId: number;
  let reportId: number;
  let token: string;
  const createdFlagIds: number[] = [];

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `report-flags-routes-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;

    const reporter = await prisma.user.create({
      data: { email: `report-flags-routes-test-reporter-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    reporterId = reporter.id;
    token = jwt.sign({ sub: reporter.id, email: reporter.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const report = await prisma.report.create({
      data: {
        userId,
        reportType: "found",
        status: "published",
        title: "Perrito encontrado en Plaza de Mayo",
      },
    });
    reportId = report.id;
  });

  afterEach(async () => {
    while (createdFlagIds.length > 0) {
      const id = createdFlagIds.pop()!;
      await prisma.reportFlag.deleteMany({ where: { id } });
    }
  });

  afterAll(async () => {
    await prisma.reportFlag.deleteMany({ where: { reportId } });
    await prisma.report.delete({ where: { id: reportId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: reporterId } });
    await prisma.$disconnect();
  });

  test("POST /api/reports/:id/flags crea un reporte de moderación y responde 201", async () => {
    const res = await request(app)
      .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
      .send({ userId: reporterId, reason: "Publicación falsa" });

    expect(res.status).toBe(201);
    expect(res.body.reportId).toBe(reportId);
    expect(res.body.userId).toBe(reporterId);
    expect(res.body.reason).toBe("Publicación falsa");
    expect(res.body.status).toBe("pending");
    createdFlagIds.push(res.body.id);
  });

  test("POST /api/reports/:id/flags responde 400 si falta reason", async () => {
    const res = await request(app).post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`).send({ userId: reporterId });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("POST /api/reports/:id/flags responde 400 si falta userId", async () => {
    const res = await request(app).post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`).send({ reason: "Publicación falsa" });
    expect(res.status).toBe(400);
  });

  test("POST /api/reports/:id/flags responde 404 si el reporte no existe", async () => {
    const res = await request(app)
      .post("/api/reports/999999999/flags").set("Authorization", `Bearer ${token}`)
      .send({ userId: reporterId, reason: "Publicación falsa" });
    expect(res.status).toBe(404);
  });

  test("POST /api/reports/:id/flags responde 400 si el id no es numérico", async () => {
    const res = await request(app)
      .post("/api/reports/abc/flags").set("Authorization", `Bearer ${token}`)
      .send({ userId: reporterId, reason: "Publicación falsa" });
    expect(res.status).toBe(400);
  });

  test("POST /api/reports/:id/flags responde 409 si el mismo usuario reporta la misma publicación dos veces", async () => {
    const first = await request(app)
      .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
      .send({ userId: reporterId, reason: "Publicación falsa" });
    createdFlagIds.push(first.body.id);

    const res = await request(app)
      .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
      .send({ userId: reporterId, reason: "Otra vez" });
    expect(res.status).toBe(409);
  });
});
