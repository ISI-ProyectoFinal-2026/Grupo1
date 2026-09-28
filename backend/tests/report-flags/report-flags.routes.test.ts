import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

describe("report-flags routes", () => {
  let userId: number;
  let reporterId: number;
  let moderatorId: number;
  let reportId: number;
  let token: string;
  let moderatorToken: string;
  let regularToken: string;
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
    regularToken = token;

    const moderator = await prisma.user.create({
      data: {
        email: `report-flags-routes-test-moderator-${Date.now()}@example.com`,
        passwordHash: "test-hash",
        role: "moderador",
      },
    });
    moderatorId = moderator.id;
    moderatorToken = jwt.sign({ sub: moderator.id, email: moderator.email }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });

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
    await prisma.report.update({ where: { id: reportId }, data: { status: "published" } });
  });

  afterAll(async () => {
    await prisma.reportFlag.deleteMany({ where: { reportId } });
    await prisma.report.delete({ where: { id: reportId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: reporterId } });
    await prisma.user.delete({ where: { id: moderatorId } });
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

  describe("GET /api/report-flags", () => {
    test("responde 401 sin token", async () => {
      const res = await request(app).get("/api/report-flags");
      expect(res.status).toBe(401);
    });

    test("responde 403 si el usuario no es moderador ni admin", async () => {
      const res = await request(app).get("/api/report-flags").set("Authorization", `Bearer ${regularToken}`);
      expect(res.status).toBe(403);
    });

    test("un moderador lista flags pending por defecto, con contexto del reporte", async () => {
      const created = await request(app)
        .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
        .send({ userId: reporterId, reason: "Publicación falsa" });
      createdFlagIds.push(created.body.id);

      const res = await request(app).get("/api/report-flags").set("Authorization", `Bearer ${moderatorToken}`);

      expect(res.status).toBe(200);
      const flag = res.body.find((f: { id: number }) => f.id === created.body.id);
      expect(flag).toBeDefined();
      expect(flag.status).toBe("pending");
      expect(flag.report.id).toBe(reportId);
      expect(flag.report.title).toBe("Perrito encontrado en Plaza de Mayo");
      expect(res.body.every((f: { status: string }) => f.status === "pending")).toBe(true);
    });

    test("status=reviewed filtra solo los flags ya revisados", async () => {
      const created = await request(app)
        .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
        .send({ userId: reporterId, reason: "Publicación falsa" });
      createdFlagIds.push(created.body.id);

      await request(app)
        .patch(`/api/report-flags/${created.body.id}`).set("Authorization", `Bearer ${moderatorToken}`);

      const res = await request(app)
        .get("/api/report-flags?status=reviewed").set("Authorization", `Bearer ${moderatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.every((f: { status: string }) => f.status === "reviewed")).toBe(true);
      expect(res.body.some((f: { id: number }) => f.id === created.body.id)).toBe(true);
    });
  });

  describe("PATCH /api/report-flags/:id", () => {
    test("responde 401 sin token", async () => {
      const res = await request(app).patch("/api/report-flags/1");
      expect(res.status).toBe(401);
    });

    test("responde 403 si el usuario no es moderador ni admin", async () => {
      const created = await request(app)
        .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
        .send({ userId: reporterId, reason: "Publicación falsa" });
      createdFlagIds.push(created.body.id);

      const res = await request(app)
        .patch(`/api/report-flags/${created.body.id}`).set("Authorization", `Bearer ${regularToken}`);
      expect(res.status).toBe(403);
    });

    test("un moderador resuelve el flag: queda reviewed y el reporte queda rejected", async () => {
      const created = await request(app)
        .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
        .send({ userId: reporterId, reason: "Publicación falsa" });
      createdFlagIds.push(created.body.id);

      const res = await request(app)
        .patch(`/api/report-flags/${created.body.id}`).set("Authorization", `Bearer ${moderatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("reviewed");

      const report = await prisma.report.findUnique({ where: { id: reportId } });
      expect(report?.status).toBe("rejected");
    });

    test("responde 409 si el flag ya fue revisado", async () => {
      const created = await request(app)
        .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
        .send({ userId: reporterId, reason: "Publicación falsa" });
      createdFlagIds.push(created.body.id);

      await request(app)
        .patch(`/api/report-flags/${created.body.id}`).set("Authorization", `Bearer ${moderatorToken}`);
      const res = await request(app)
        .patch(`/api/report-flags/${created.body.id}`).set("Authorization", `Bearer ${moderatorToken}`);

      expect(res.status).toBe(409);
    });

    test("responde 404 si el flag no existe", async () => {
      const res = await request(app)
        .patch("/api/report-flags/999999999").set("Authorization", `Bearer ${moderatorToken}`);
      expect(res.status).toBe(404);
    });
  });
});
