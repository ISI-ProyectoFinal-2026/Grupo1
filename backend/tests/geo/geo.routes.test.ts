import request from "supertest";
import { createTestUser } from "../helpers/users";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createPublishedReport, mockImageModeration } from "../helpers/reports";

describe("GET /api/geo/nearby y GET /api/geo/map", () => {
  let userId: number;
  let token: string;
  const createdReportIds: number[] = [];

  function reportAt(lat: number, lng: number, title: string) {
    return { userId, reportType: "found", title, location: { lat, lng } };
  }

  function createReport(lat: number, lng: number, title: string) {
    return createPublishedReport(token, reportAt(lat, lng, title));
  }

  beforeAll(async () => {
    const user = await createTestUser({ prefix: "geo-routes-test" });
    userId = user.user.id;
    token = user.token;
  });

  beforeEach(() => {
    mockImageModeration();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
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
    createdReportIds.push(inside.id);
    const outside = await createReport(-38.0055, -57.5426, "En Mar del Plata");
    createdReportIds.push(outside.id);

    const res = await request(app).get("/api/geo/nearby?lat=-34.6037&lng=-58.3816&radius=5");

    expect(res.status).toBe(200);
    expect(res.body.some((r: { id: number }) => r.id === inside.id)).toBe(true);
    expect(res.body.some((r: { id: number }) => r.id === outside.id)).toBe(false);
  });

  test("GET /api/geo/nearby incluye las coordenadas lat/lng de cada reporte", async () => {
    const created = await createReport(-34.6037, -58.3816, "Con coordenadas");
    createdReportIds.push(created.id);

    const res = await request(app).get("/api/geo/nearby?lat=-34.6037&lng=-58.3816&radius=5");

    const found = res.body.find((r: { id: number }) => r.id === created.id);
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
    createdReportIds.push(inside.id);
    const outside = await createReport(-38.0055, -57.5426, "Fuera del bbox");
    createdReportIds.push(outside.id);

    const res = await request(app).get("/api/geo/map?bounds=-34.7,-58.5,-34.5,-58.3");

    expect(res.status).toBe(200);
    expect(res.body.some((r: { id: number }) => r.id === inside.id)).toBe(true);
    expect(res.body.some((r: { id: number }) => r.id === outside.id)).toBe(false);
  });

  test("GET /api/geo/map incluye las coordenadas lat/lng de cada reporte", async () => {
    const created = await createReport(-34.6037, -58.3816, "Con coordenadas");
    createdReportIds.push(created.id);

    const res = await request(app).get("/api/geo/map?bounds=-34.7,-58.5,-34.5,-58.3");

    const found = res.body.find((r: { id: number }) => r.id === created.id);
    expect(found.location).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
  });

  describe("filtros del feed y tope de resultados", () => {
    const BBOX = "-34.7,-58.5,-34.5,-58.3";

    function ids(body: { id: number }[]) {
      return body.map((r) => r.id);
    }

    async function createTracked(data: Record<string, unknown>) {
      const created = await createPublishedReport(token, { userId, location: { lat: -34.6037, lng: -58.3816 }, ...data });
      createdReportIds.push(created.id);
      return created;
    }

    test("GET /api/geo/map filtra por type", async () => {
      const lost = await createTracked({ reportType: "lost", title: "Perdido" });
      const found = await createTracked({ reportType: "found", title: "Encontrado" });

      const res = await request(app).get(`/api/geo/map?bounds=${BBOX}&type=lost`);

      expect(res.status).toBe(200);
      expect(ids(res.body)).toContain(lost.id);
      expect(ids(res.body)).not.toContain(found.id);
    });

    test("GET /api/geo/map filtra por zone sobre la dirección", async () => {
      const palermo = await createTracked({ reportType: "found", title: "En Palermo", locationAddress: "Palermo, CABA" });
      const caballito = await createTracked({ reportType: "found", title: "En Caballito", locationAddress: "Caballito, CABA" });

      const res = await request(app).get(`/api/geo/map?bounds=${BBOX}&zone=palermo`);

      expect(ids(res.body)).toContain(palermo.id);
      expect(ids(res.body)).not.toContain(caballito.id);
    });

    test("GET /api/geo/map filtra por rango de fechas", async () => {
      const created = await createTracked({ reportType: "found", title: "Por fecha" });

      const futuro = await request(app).get(`/api/geo/map?bounds=${BBOX}&dateFrom=2999-01-01`);
      const pasado = await request(app).get(`/api/geo/map?bounds=${BBOX}&dateTo=2000-01-01`);
      const dentro = await request(app).get(`/api/geo/map?bounds=${BBOX}&dateFrom=2000-01-01&dateTo=2999-01-01`);

      expect(ids(futuro.body)).not.toContain(created.id);
      expect(ids(pasado.body)).not.toContain(created.id);
      expect(ids(dentro.body)).toContain(created.id);
    });

    test("GET /api/geo/map respeta limit y devuelve los más nuevos", async () => {
      // zona propia: otras suites crean reportes en el mismo bbox en paralelo
      const zone = `geo-limit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const viejo = await createTracked({ reportType: "found", title: "Viejo", locationAddress: zone });
      const nuevo = await createTracked({ reportType: "found", title: "Nuevo", locationAddress: zone });
      // orden explícito: dos inserts seguidos pueden empatar en created_at
      await prisma.report.update({ where: { id: viejo.id }, data: { createdAt: new Date(Date.now() - 60_000) } });

      const res = await request(app).get(`/api/geo/map?bounds=${BBOX}&zone=${zone}&limit=1`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(nuevo.id);
    });

    test("GET /api/geo/map aplica un tope por defecto cuando no se pasa limit", async () => {
      const res = await request(app).get(`/api/geo/map?bounds=${BBOX}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(200);
    });

    test("GET /api/geo/map responde 400 si type, fechas o limit son inválidos", async () => {
      for (const query of ["type=otro", "dateFrom=nofecha", "limit=0", "limit=501", "limit=abc"]) {
        const res = await request(app).get(`/api/geo/map?bounds=${BBOX}&${query}`);
        expect(res.status).toBe(400);
      }
    });

    test("GET /api/geo/nearby filtra por type y respeta limit", async () => {
      const lost = await createTracked({ reportType: "lost", title: "Perdido cerca" });
      const found = await createTracked({ reportType: "found", title: "Encontrado cerca" });

      const porTipo = await request(app).get("/api/geo/nearby?lat=-34.6037&lng=-58.3816&radius=5&type=lost");
      const conTope = await request(app).get("/api/geo/nearby?lat=-34.6037&lng=-58.3816&radius=5&limit=1");

      expect(ids(porTipo.body)).toContain(lost.id);
      expect(ids(porTipo.body)).not.toContain(found.id);
      expect(conTope.body).toHaveLength(1);
    });
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
