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
});
