import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

describe("GET /api/geo/nearby y GET /api/geo/map", () => {
  let userId: number;
  let token: string;
  const createdReportIds: number[] = [];

  function reportAt(lat: number, lng: number, title: string) {
    return { userId, reportType: "found", title, location: { lat, lng } };
  }

  function createReport(lat: number, lng: number, title: string) {
    return request(app).post("/api/reports").set("Authorization", `Bearer ${token}`).send(reportAt(lat, lng, title));
  }

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `geo-routes-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;
    token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });
  });

  afterEach(async () => {
    while (createdReportIds.length > 0) {
      const id = createdReportIds.pop();
      if (id !== undefined) {
        await prisma.report.deleteMany({ where: { id } });
      }
    }
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test("GET /api/geo/nearby responde 200 con reportes dentro del radio y excluye los lejanos", async () => {
    const inside = await createReport(-34.6037, -58.3816, "Cerca del Obelisco");
    createdReportIds.push(inside.body.id);
    const outside = await createReport(-38.0055, -57.5426, "En Mar del Plata");
    createdReportIds.push(outside.body.id);

    const res = await request(app).get("/api/geo/nearby?lat=-34.6037&lng=-58.3816&radius=5");

    expect(res.status).toBe(200);
    expect(res.body.some((r: { id: number }) => r.id === inside.body.id)).toBe(true);
    expect(res.body.some((r: { id: number }) => r.id === outside.body.id)).toBe(false);
  });

  test("GET /api/geo/nearby incluye las coordenadas lat/lng de cada reporte", async () => {
    const created = await createReport(-34.6037, -58.3816, "Con coordenadas");
    createdReportIds.push(created.body.id);

    const res = await request(app).get("/api/geo/nearby?lat=-34.6037&lng=-58.3816&radius=5");

    const found = res.body.find((r: { id: number }) => r.id === created.body.id);
    expect(found.location).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
  });

  test("GET /api/geo/nearby responde 400 si faltan parámetros", async () => {
    const res = await request(app).get("/api/geo/nearby?lat=-34.6");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("GET /api/geo/nearby responde 400 si lat/lng están fuera de rango", async () => {
    const res = await request(app).get("/api/geo/nearby?lat=999&lng=-58.4&radius=5");
    expect(res.status).toBe(400);
  });

  test("GET /api/geo/nearby responde 400 si radius no es un número positivo", async () => {
    const res = await request(app).get("/api/geo/nearby?lat=-34.6&lng=-58.4&radius=-5");
    expect(res.status).toBe(400);
  });

  test("GET /api/geo/map responde 200 con reportes dentro del bounding box y excluye los que quedan afuera", async () => {
    const inside = await createReport(-34.6037, -58.3816, "Dentro del bbox");
    createdReportIds.push(inside.body.id);
    const outside = await createReport(-38.0055, -57.5426, "Fuera del bbox");
    createdReportIds.push(outside.body.id);

    const res = await request(app).get("/api/geo/map?bounds=-34.7,-58.5,-34.5,-58.3");

    expect(res.status).toBe(200);
    expect(res.body.some((r: { id: number }) => r.id === inside.body.id)).toBe(true);
    expect(res.body.some((r: { id: number }) => r.id === outside.body.id)).toBe(false);
  });

  test("GET /api/geo/map incluye las coordenadas lat/lng de cada reporte", async () => {
    const created = await createReport(-34.6037, -58.3816, "Con coordenadas");
    createdReportIds.push(created.body.id);

    const res = await request(app).get("/api/geo/map?bounds=-34.7,-58.5,-34.5,-58.3");

    const found = res.body.find((r: { id: number }) => r.id === created.body.id);
    expect(found.location).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
  });

  test("GET /api/geo/map responde 400 si falta bounds", async () => {
    const res = await request(app).get("/api/geo/map");
    expect(res.status).toBe(400);
  });

  test("GET /api/geo/map responde 400 si bounds está mal formado", async () => {
    const res = await request(app).get("/api/geo/map?bounds=abc,def,ghi");
    expect(res.status).toBe(400);
  });

  test("GET /api/geo/map responde 400 si bounds tiene coordenadas fuera de rango", async () => {
    const res = await request(app).get("/api/geo/map?bounds=-999,-58.5,-34.5,-58.3");
    expect(res.status).toBe(400);
  });
});
