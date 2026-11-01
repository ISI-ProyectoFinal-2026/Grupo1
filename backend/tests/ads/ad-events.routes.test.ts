import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { addMonths } from "../../src/services/business-plan";
import { STATS_DAYS } from "../../src/services/ad-events.service";
import { createTestUser } from "../helpers/users";

const TIME_ZONE = "America/Argentina/Buenos_Aires";
const localDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);

describe("métricas de anuncios", () => {
  let ownerId: number;
  let ownerToken: string;
  let viewerId: number;
  let viewerToken: string;
  let businessId: number;
  let adId: number;

  const postEvent = (id: number, body: object, token?: string) => {
    const req = request(app).post(`/api/ads/${id}/events`).send(body);
    return token ? req.set("Authorization", `Bearer ${token}`) : req;
  };

  const getStats = (id: number, token = ownerToken) =>
    request(app).get(`/api/businesses/me/ads/${id}/stats`).set("Authorization", `Bearer ${token}`);

  async function seedEvent(type: "impression" | "click", placement: "feed" | "report_detail", createdAt = new Date()) {
    await prisma.adEvent.create({ data: { adId, type, placement, createdAt } });
  }

  beforeAll(async () => {
    const owner = await createTestUser({ prefix: "ad-events-owner" });
    ownerId = owner.user.id;
    ownerToken = owner.token;
    const viewer = await createTestUser({ prefix: "ad-events-viewer" });
    viewerId = viewer.user.id;
    viewerToken = viewer.token;
  });

  beforeEach(async () => {
    const business = await prisma.business.create({
      data: {
        userId: ownerId,
        name: "Métricas",
        cuit: `ad-events-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        address: "x",
        phone: "1",
        category: "PET_SHOP",
        latitude: -34.6,
        longitude: -68.33,
        plan: "PREMIUM",
        planExpiresAt: addMonths(new Date(), 1),
      },
    });
    businessId = business.id;
    const ad = await prisma.ad.create({
      data: { businessId, title: "Promo", body: "x", imageUrl: "https://pub-test.r2.dev/a.jpg", radiusKm: 5 },
    });
    adId = ad.id;
  });

  afterEach(async () => {
    await prisma.business.deleteMany({ where: { userId: ownerId } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, viewerId] } } });
    await prisma.$disconnect();
  });

  describe("POST /api/ads/:adId/events", () => {
    test("registra una impresión anónima sin usuario ni coordenadas", async () => {
      const res = await postEvent(adId, { type: "impression", placement: "feed" });

      expect(res.status).toBe(204);
      const events = await prisma.adEvent.findMany({ where: { adId } });
      expect(events).toHaveLength(1);
      expect(Object.keys(events[0]).sort()).toEqual(["adId", "createdAt", "id", "placement", "type"]);
    });

    test("registra un clic de un usuario con sesión", async () => {
      expect((await postEvent(adId, { type: "click", placement: "report_detail" }, viewerToken)).status).toBe(204);
      expect(await prisma.adEvent.count({ where: { adId, type: "click" } })).toBe(1);
    });

    test("descarta en silencio los eventos del propio dueño", async () => {
      const res = await postEvent(adId, { type: "impression", placement: "feed" }, ownerToken);

      expect(res.status).toBe(204);
      expect(await prisma.adEvent.count({ where: { adId } })).toBe(0);
    });

    test.each([
      ["un tipo desconocido", { type: "conversion", placement: "feed" }],
      ["una ubicación desconocida", { type: "click", placement: "flyer" }],
    ])("rechaza %s con 400", async (_label, body) => {
      expect((await postEvent(adId, body)).status).toBe(400);
    });

    test("un anuncio inexistente responde 404", async () => {
      expect((await postEvent(999999999, { type: "click", placement: "feed" })).status).toBe(404);
    });

    test("un anuncio pausado o dado de baja no suma eventos (404)", async () => {
      await prisma.ad.update({ where: { id: adId }, data: { status: "PAUSED" } });
      expect((await postEvent(adId, { type: "click", placement: "feed" })).status).toBe(404);

      await prisma.ad.update({ where: { id: adId }, data: { status: "REMOVED" } });
      expect((await postEvent(adId, { type: "click", placement: "feed" })).status).toBe(404);
    });

    test("un anuncio de un Premium vencido no suma eventos (404)", async () => {
      await prisma.business.update({ where: { id: businessId }, data: { planExpiresAt: new Date(Date.now() - 1000) } });

      expect((await postEvent(adId, { type: "impression", placement: "feed" })).status).toBe(404);
    });
  });

  describe("GET /api/businesses/me/ads/:adId/stats", () => {
    test("un anuncio sin eventos devuelve ceros y CTR 0", async () => {
      const res = await getStats(adId);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ impressions: 0, clicks: 0, ctr: 0 });
      expect(res.body.daily).toHaveLength(STATS_DAYS);
      expect(res.body.byPlacement).toEqual([
        { placement: "feed", impressions: 0, clicks: 0 },
        { placement: "report_detail", impressions: 0, clicks: 0 },
      ]);
    });

    test("agrega totales, CTR y desglose por ubicación", async () => {
      for (let i = 0; i < 3; i++) await seedEvent("impression", "feed");
      await seedEvent("impression", "report_detail");
      await seedEvent("click", "feed");

      const res = await getStats(adId);

      expect(res.body).toMatchObject({ impressions: 4, clicks: 1, ctr: 0.25 });
      expect(res.body.byPlacement).toEqual([
        { placement: "feed", impressions: 3, clicks: 1 },
        { placement: "report_detail", impressions: 1, clicks: 0 },
      ]);
    });

    test("agrupa por día en hora de Argentina y completa los días sin eventos", async () => {
      const now = new Date();
      const today = localDate(now);
      const startOfTodayLocal = new Date(`${today}T00:00:00-03:00`);
      await seedEvent("impression", "feed", now);
      // un minuto antes de la medianoche local: cuenta para ayer
      await seedEvent("impression", "feed", new Date(startOfTodayLocal.getTime() - 60_000));
      // fuera de la ventana
      await seedEvent("impression", "feed", new Date(now.getTime() - (STATS_DAYS + 2) * 86_400_000));

      const res = await getStats(adId);
      const daily: { date: string; impressions: number; clicks: number }[] = res.body.daily;

      expect(daily).toHaveLength(STATS_DAYS);
      expect(daily[daily.length - 1]).toEqual({ date: today, impressions: 1, clicks: 0 });
      expect(daily[daily.length - 2]).toEqual({
        date: localDate(new Date(startOfTodayLocal.getTime() - 60_000)),
        impressions: 1,
        clicks: 0,
      });
      expect(daily.reduce((sum, day) => sum + day.impressions, 0)).toBe(2);
      // los totales cubren todo el historial
      expect(res.body.impressions).toBe(3);
    });

    test("el anuncio de otro comercio responde 404", async () => {
      expect((await getStats(adId, viewerToken)).status).toBe(404);
    });

    test("borrar el anuncio elimina en cascada sus eventos", async () => {
      await seedEvent("click", "feed");

      await prisma.ad.delete({ where: { id: adId } });

      expect(await prisma.adEvent.count({ where: { adId } })).toBe(0);
    });
  });
});
