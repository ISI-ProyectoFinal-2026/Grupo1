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
  let ownerToken: string;
  const createdFlagIds: number[] = [];

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `report-flags-routes-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;
    ownerToken = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

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
    await prisma.notification.deleteMany({ where: { reportId } });
    await prisma.report.update({ where: { id: reportId }, data: { status: "published", flagCycle: 0 } });
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
      .send({ userId: reporterId, reason: "false_info" });

    expect(res.status).toBe(201);
    expect(res.body.reportId).toBe(reportId);
    expect(res.body.userId).toBe(reporterId);
    expect(res.body.reason).toBe("false_info");
    expect(res.body.status).toBe("pending");
    createdFlagIds.push(res.body.id);
  });

  test("POST /api/reports/:id/flags responde 400 con un motivo fuera de la lista o other sin detalle", async () => {
    for (const body of [{ reason: "me cae mal" }, { reason: "other" }, { reason: "other", detail: "  " }]) {
      const res = await request(app).post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`).send(body);
      expect(res.status).toBe(400);
    }
    expect(await prisma.reportFlag.count({ where: { reportId } })).toBe(0);
  });

  test("POST /api/reports/:id/flags acepta other con detalle", async () => {
    const res = await request(app)
      .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
      .send({ reason: "other", detail: "Es publicidad" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ reason: "other", detail: "Es publicidad" });
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
      .send({ userId: reporterId, reason: "false_info" });
    expect(res.status).toBe(404);
  });

  test("POST /api/reports/:id/flags responde 400 si el id no es numérico", async () => {
    const res = await request(app)
      .post("/api/reports/abc/flags").set("Authorization", `Bearer ${token}`)
      .send({ userId: reporterId, reason: "false_info" });
    expect(res.status).toBe(400);
  });

  test("POST /api/reports/:id/flags responde 409 si el mismo usuario reporta la misma publicación dos veces", async () => {
    const first = await request(app)
      .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
      .send({ userId: reporterId, reason: "false_info" });
    createdFlagIds.push(first.body.id);

    const res = await request(app)
      .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
      .send({ userId: reporterId, reason: "spam" });
    expect(res.status).toBe(409);
  });

  test("POST /api/reports/:id/flags responde 403 si el dueño denuncia su propio reporte", async () => {
    const res = await request(app)
      .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${ownerToken}`)
      .send({ reason: "false_info" });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("No podés denunciar tu propia publicación");
  });

  test.each(["pending", "rejected", "resolved", "hidden"] as const)(
    "POST /api/reports/:id/flags responde 404 si el reporte está %s",
    async (status) => {
      await prisma.report.update({ where: { id: reportId }, data: { status } });

      const res = await request(app)
        .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
        .send({ reason: "false_info" });
      expect(res.status).toBe(404);
    }
  );

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
        .send({ userId: reporterId, reason: "false_info" });
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
        .send({ userId: reporterId, reason: "false_info" });
      createdFlagIds.push(created.body.id);

      await prisma.reportFlag.update({ where: { id: created.body.id }, data: { status: "reviewed" } });

      const res = await request(app)
        .get("/api/report-flags?status=reviewed").set("Authorization", `Bearer ${moderatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.every((f: { status: string }) => f.status === "reviewed")).toBe(true);
      expect(res.body.some((f: { id: number }) => f.id === created.body.id)).toBe(true);
    });
  });

  describe("GET /api/report-flags/reports", () => {
    test("responde 401 sin token y 403 a un usuario común", async () => {
      expect((await request(app).get("/api/report-flags/reports")).status).toBe(401);
      const res = await request(app).get("/api/report-flags/reports").set("Authorization", `Bearer ${regularToken}`);
      expect(res.status).toBe(403);
    });

    test("un moderador ve la cola agrupada por reporte", async () => {
      const created = await request(app)
        .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
        .send({ reason: "other", detail: "Es publicidad" });
      createdFlagIds.push(created.body.id);

      const res = await request(app).get("/api/report-flags/reports").set("Authorization", `Bearer ${moderatorToken}`);

      expect(res.status).toBe(200);
      const group = res.body.find((g: { report: { id: number } }) => g.report.id === reportId);
      expect(group).toMatchObject({ flagCount: 1, reasonCounts: { other: 1 }, otherDetails: ["Es publicidad"] });
    });
  });

  describe("PATCH /api/report-flags/reports/:reportId", () => {
    const patch = (tk: string, body: object = { action: "hide" }, id: number | string = reportId) =>
      request(app).patch(`/api/report-flags/reports/${id}`).set("Authorization", `Bearer ${tk}`).send(body);

    async function flag() {
      const created = await request(app)
        .post(`/api/reports/${reportId}/flags`).set("Authorization", `Bearer ${token}`)
        .send({ reason: "false_info" });
      createdFlagIds.push(created.body.id);
    }

    test("responde 401 sin token", async () => {
      const res = await request(app).patch(`/api/report-flags/reports/${reportId}`).send({ action: "hide" });
      expect(res.status).toBe(401);
    });

    test("responde 403 si el usuario no es moderador ni admin", async () => {
      await flag();
      const res = await patch(regularToken);
      expect(res.status).toBe(403);
      expect((await prisma.report.findUniqueOrThrow({ where: { id: reportId } })).status).toBe("published");
    });

    test("responde 400 sin una acción válida o con id inválido", async () => {
      await flag();
      for (const body of [{}, { action: "accept" }]) {
        expect((await patch(moderatorToken, body)).status).toBe(400);
      }
      expect((await patch(moderatorToken, { action: "hide" }, "abc")).status).toBe(400);
    });

    test("un moderador descarta: el reporte sigue publicado y las denuncias quedan dismissed", async () => {
      await flag();
      const res = await patch(moderatorToken, { action: "dismiss" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: reportId, status: "published" });
      expect(await prisma.reportFlag.count({ where: { reportId, status: "dismissed" } })).toBe(1);
    });

    test("un moderador oculta, confirma y ya no puede restaurar (409)", async () => {
      await flag();
      expect((await patch(moderatorToken, { action: "hide" })).body.status).toBe("hidden");
      expect((await patch(moderatorToken, { action: "confirm" })).status).toBe(200);

      const res = await patch(moderatorToken, { action: "restore" });
      expect(res.status).toBe(409);
      expect((await prisma.report.findUniqueOrThrow({ where: { id: reportId } })).status).toBe("hidden");
    });

    test("un admin también puede restaurar un reporte oculto", async () => {
      await flag();
      await patch(moderatorToken, { action: "hide" });
      await prisma.user.update({ where: { id: moderatorId }, data: { role: "admin" } });
      const res = await patch(moderatorToken, { action: "restore" });
      await prisma.user.update({ where: { id: moderatorId }, data: { role: "moderador" } });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("published");
    });

    test("responde 409 si ya fue revisado y 404 si el reporte no existe", async () => {
      await flag();
      await patch(moderatorToken, { action: "dismiss" });
      expect((await patch(moderatorToken, { action: "dismiss" })).status).toBe(409);
      expect((await patch(moderatorToken, { action: "hide" }, 999999999)).status).toBe(404);
    });
  });
});
