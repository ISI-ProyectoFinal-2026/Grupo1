import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

describe("GET/POST/PUT/DELETE /api/reports", () => {
  let userId: number;
  const createdReportIds: number[] = [];
  const baseReportData = {
    reportType: "found",
    title: "Perrito encontrado en Plaza de Mayo",
    description: "Cachorro mestizo, collar rojo",
    imageUrl: "https://cdn.example.com/hallazgo.jpg",
    location: { lat: -34.6037, lng: -58.3816 },
    locationAddress: "Plaza de Mayo, CABA",
  };

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `reports-routes-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;
  });

  afterEach(async () => {
    while (createdReportIds.length > 0) {
      const id = createdReportIds.pop()!;
      await prisma.report.deleteMany({ where: { id } });
    }
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test("POST /api/reports crea un reporte y responde 201 con status published", async () => {
    const res = await request(app).post("/api/reports").send({ userId, ...baseReportData });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("published");
    expect(res.body.petId).toBeNull();
    expect(res.body.location).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
    createdReportIds.push(res.body.id);
  });

  test("POST /api/reports responde 400 si falta location (PIN de coordenadas)", async () => {
    const { location, ...withoutLocation } = baseReportData;
    const res = await request(app).post("/api/reports").send({ userId, ...withoutLocation });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("POST /api/reports responde 400 si falta title", async () => {
    const { title, ...withoutTitle } = baseReportData;
    const res = await request(app).post("/api/reports").send({ userId, ...withoutTitle });
    expect(res.status).toBe(400);
  });

  test("POST /api/reports responde 400 si el userId no existe", async () => {
    const res = await request(app).post("/api/reports").send({ userId: 999999999, ...baseReportData });
    expect(res.status).toBe(400);
  });

  test("POST /api/reports responde 400 si el JSON del body está mal formado", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Content-Type", "application/json")
      .send('{"userId":1,"title":"Malformado"');
    expect(res.status).toBe(400);
  });

  test("GET /api/reports responde 200 con un array e incluye el creado", async () => {
    const created = await request(app).post("/api/reports").send({ userId, ...baseReportData });
    createdReportIds.push(created.body.id);

    const res = await request(app).get("/api/reports");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((r: { id: number }) => r.id === created.body.id)).toBe(true);
  });

  test("GET /api/reports?type=found filtra por tipo", async () => {
    const created = await request(app).post("/api/reports").send({ userId, ...baseReportData });
    createdReportIds.push(created.body.id);

    const res = await request(app).get("/api/reports?type=found&status=published");
    expect(res.status).toBe(200);
    expect(res.body.some((r: { id: number }) => r.id === created.body.id)).toBe(true);
  });

  test("GET /api/reports/:id responde 200 con el reporte", async () => {
    const created = await request(app).post("/api/reports").send({ userId, ...baseReportData });
    createdReportIds.push(created.body.id);

    const res = await request(app).get(`/api/reports/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  test("GET /api/reports/:id responde 404 si no existe", async () => {
    const res = await request(app).get("/api/reports/999999999");
    expect(res.status).toBe(404);
  });

  test("GET /api/reports/:id responde 400 si el id no es numérico", async () => {
    const res = await request(app).get("/api/reports/abc");
    expect(res.status).toBe(400);
  });

  test("PUT /api/reports/:id actualiza el reporte", async () => {
    const created = await request(app).post("/api/reports").send({ userId, ...baseReportData });
    createdReportIds.push(created.body.id);

    const res = await request(app).put(`/api/reports/${created.body.id}`).send({ title: "Actualizado" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Actualizado");
  });

  test("PUT /api/reports/:id responde 404 si no existe", async () => {
    const res = await request(app).put("/api/reports/999999999").send({ title: "x" });
    expect(res.status).toBe(404);
  });

  test("DELETE /api/reports/:id elimina el reporte y responde 204", async () => {
    const created = await request(app).post("/api/reports").send({ userId, ...baseReportData });
    const res = await request(app).delete(`/api/reports/${created.body.id}`);
    expect(res.status).toBe(204);

    const getRes = await request(app).get(`/api/reports/${created.body.id}`);
    expect(getRes.status).toBe(404);
  });

  test("DELETE /api/reports/:id responde 404 si no existe", async () => {
    const res = await request(app).delete("/api/reports/999999999");
    expect(res.status).toBe(404);
  });

  test("POST /api/reports responde con tag ENCONTRADO cuando reportType es found", async () => {
    const res = await request(app).post("/api/reports").send({ userId, ...baseReportData });
    createdReportIds.push(res.body.id);
    expect(res.body.tag).toEqual({ label: "ENCONTRADO", color: expect.any(String) });
  });

  test("PUT /api/reports/:id con status resolved responde con tag RESUELTO", async () => {
    const created = await request(app).post("/api/reports").send({ userId, ...baseReportData });
    createdReportIds.push(created.body.id);

    const res = await request(app).put(`/api/reports/${created.body.id}`).send({ status: "resolved" });
    expect(res.body.tag.label).toBe("RESUELTO");
  });

  test("GET /api/reports/:id/matches responde 200 con la lista de matches sugeridos", async () => {
    const lost = await request(app)
      .post("/api/reports")
      .send({ userId, ...baseReportData, reportType: "lost", title: "Perdido cerca de Once" });
    createdReportIds.push(lost.body.id);
    const found = await request(app)
      .post("/api/reports")
      .send({ userId, ...baseReportData, reportType: "found", title: "Encontrado en Once" });
    createdReportIds.push(found.body.id);

    await prisma.reportMatch.create({
      data: { reportLostId: lost.body.id, reportFoundId: found.body.id, similarityScore: 0.81, status: "pending" },
    });

    const res = await request(app).get(`/api/reports/${lost.body.id}/matches`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      reportId: found.body.id,
      title: "Encontrado en Once",
      reportType: "found",
      similarityScore: 0.81,
      status: "pending",
    });

    await prisma.reportMatch.deleteMany({ where: { reportLostId: lost.body.id, reportFoundId: found.body.id } });
  });

  test("GET /api/reports/:id/matches responde 200 con un array vacío si no hay matches", async () => {
    const created = await request(app).post("/api/reports").send({ userId, ...baseReportData });
    createdReportIds.push(created.body.id);

    const res = await request(app).get(`/api/reports/${created.body.id}/matches`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("GET /api/reports/:id/matches responde 404 si el reporte no existe", async () => {
    const res = await request(app).get("/api/reports/999999999/matches");
    expect(res.status).toBe(404);
  });

  test("GET /api/reports sin filtros solo trae reportes activos (published)", async () => {
    const created = await request(app).post("/api/reports").send({ userId, ...baseReportData });
    createdReportIds.push(created.body.id);
    await request(app).put(`/api/reports/${created.body.id}`).send({ status: "resolved" });

    const res = await request(app).get("/api/reports");
    expect(res.status).toBe(200);
    expect(res.body.some((r: { id: number }) => r.id === created.body.id)).toBe(false);
  });

  test("GET /api/reports?zone= filtra por zona", async () => {
    const created = await request(app)
      .post("/api/reports")
      .send({ userId, ...baseReportData, locationAddress: "Plaza de Mayo, CABA" });
    createdReportIds.push(created.body.id);

    const res = await request(app).get("/api/reports?zone=Plaza de Mayo");
    expect(res.status).toBe(200);
    expect(res.body.some((r: { id: number }) => r.id === created.body.id)).toBe(true);
  });

  test("GET /api/reports?order=asc responde 200 y acepta el parámetro", async () => {
    const res = await request(app).get("/api/reports?order=asc");
    expect(res.status).toBe(200);
  });

  test("POST /api/reports/:id/close responde 200 con status resolved", async () => {
    const created = await request(app).post("/api/reports").send({ userId, ...baseReportData });
    createdReportIds.push(created.body.id);

    const res = await request(app).post(`/api/reports/${created.body.id}/close`).send({ userId });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("resolved");
    expect(res.body.tag.label).toBe("RESUELTO");
  });

  test("POST /api/reports/:id/close responde 404 si el reporte no existe", async () => {
    const res = await request(app).post("/api/reports/999999999/close").send({ userId });
    expect(res.status).toBe(404);
  });

  test("POST /api/reports/:id/close responde 403 si el userId no es el autor", async () => {
    const created = await request(app).post("/api/reports").send({ userId, ...baseReportData });
    createdReportIds.push(created.body.id);

    const res = await request(app).post(`/api/reports/${created.body.id}/close`).send({ userId: userId + 1 });
    expect(res.status).toBe(403);
  });

  test("POST /api/reports/:id/close responde 409 si el reporte ya está resuelto", async () => {
    const created = await request(app).post("/api/reports").send({ userId, ...baseReportData });
    createdReportIds.push(created.body.id);
    await request(app).post(`/api/reports/${created.body.id}/close`).send({ userId });

    const res = await request(app).post(`/api/reports/${created.body.id}/close`).send({ userId });
    expect(res.status).toBe(409);
  });

  test("POST /api/reports con imageUrl crea el reporte con status pending y GET /api/reports?status=pending lo incluye", async () => {
    const created = await request(app)
      .post("/api/reports")
      .send({ userId, ...baseReportData, imageUrl: "https://cdn.example.com/hallazgo.jpg" });
    createdReportIds.push(created.body.id);

    expect(created.status).toBe(201);
    expect(created.body.status).toBe("pending");

    const feed = await request(app).get("/api/reports");
    expect(feed.body.some((r: { id: number }) => r.id === created.body.id)).toBe(false);

    const queue = await request(app).get("/api/reports?status=pending");
    expect(queue.status).toBe(200);
    expect(queue.body.some((r: { id: number }) => r.id === created.body.id)).toBe(true);
  });
});
