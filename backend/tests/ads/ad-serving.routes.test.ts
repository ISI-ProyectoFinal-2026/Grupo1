import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { addMonths } from "../../src/services/business-plan";
import { createTestUser } from "../helpers/users";
import { isPremiumActive } from "../../src/services/ad-serving.service";
import { signAccessToken } from "../../src/utils/jwt";

// Ushuaia: lejos de los datos de las demás suites
const ORIGIN = { lat: -54.8019, lng: -68.303 };
// ~5,5 km al norte del origen
const NEAR = { lat: -54.752, lng: -68.303 };
// ~50 km al norte del origen
const FAR = { lat: -54.35, lng: -68.303 };

describe("selección de anuncios y comercios cercanos", () => {
  const userIds: number[] = [];
  let viewerToken: string;
  let viewerId: number;

  async function createBusiness(
    label: string,
    point: { lat: number; lng: number } | null,
    plan: "FREE" | "PREMIUM" = "PREMIUM",
    planExpiresAt: Date | null = addMonths(new Date(), 1)
  ) {
    const { user } = await createTestUser({ prefix: `serving-${label}` });
    userIds.push(user.id);
    return prisma.business.create({
      data: {
        userId: user.id,
        name: `Serving ${label}`,
        cuit: `serving-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        address: "Calle 1",
        phone: "1",
        category: "VETERINARIA",
        latitude: point?.lat ?? null,
        longitude: point?.lng ?? null,
        plan,
        planExpiresAt,
      },
    });
  }

  async function createAd(businessId: number, radiusKm: number, status: "ACTIVE" | "PAUSED" | "REMOVED" = "ACTIVE") {
    return prisma.ad.create({
      data: { businessId, title: "Promo", body: "Texto", imageUrl: "https://pub-test.r2.dev/ad.jpg", radiusKm, status },
    });
  }

  async function createReport(point: { lat: number; lng: number } | null, status: "published" | "pending" = "published") {
    const report = await prisma.report.create({
      data: { userId: viewerId, reportType: "found", status, title: "Perro encontrado" },
    });
    if (point) {
      await prisma.$executeRaw`
        UPDATE reports SET location = ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326) WHERE id = ${report.id}
      `;
    }
    return report;
  }

  async function setViewerLocation(point: { lat: number; lng: number }) {
    await prisma.notificationPreference.upsert({
      where: { userId: viewerId },
      create: { userId: viewerId, locationConsentStatus: "accepted", locationConsentAt: new Date() },
      update: { locationConsentStatus: "accepted" },
    });
    await prisma.$executeRaw`
      UPDATE notification_preferences
      SET location = ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326), location_updated_at = now()
      WHERE user_id = ${viewerId}
    `;
  }

  const getAd = (query: Record<string, string | number>, token?: string) => {
    const req = request(app).get("/api/ads").query(query);
    return token ? req.set("Authorization", `Bearer ${token}`) : req;
  };

  beforeAll(async () => {
    // restos de corridas interrumpidas de esta suite: sus anuncios Premium en Ushuaia pisan la selección
    await prisma.business.deleteMany({
      where: { name: { startsWith: "Serving " }, user: { email: { startsWith: "serving-" } } },
    });
    const viewer = await createTestUser({ prefix: "serving-viewer" });
    viewerId = viewer.user.id;
    viewerToken = viewer.token;
    userIds.push(viewerId);
  });

  afterEach(async () => {
    await prisma.report.deleteMany({ where: { userId: viewerId } });
    await prisma.notificationPreference.deleteMany({ where: { userId: viewerId } });
    await prisma.business.deleteMany({ where: { userId: { in: userIds } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  describe("GET /api/ads?placement=report_detail", () => {
    test("sirve un anuncio cuyo radio alcanza la ubicación del reporte", async () => {
      const business = await createBusiness("near", NEAR);
      const ad = await createAd(business.id, 10);
      const report = await createReport(ORIGIN);

      const res = await getAd({ placement: "report_detail", reportId: report.id });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: ad.id,
        title: "Promo",
        body: "Texto",
        imageUrl: ad.imageUrl,
        business: { id: business.id, name: business.name, category: "VETERINARIA" },
        segmented: true,
      });
    });

    test.each([
      ["fuera de su radio", NEAR, 2, "ACTIVE", "PREMIUM", 1],
      ["pausado", NEAR, 10, "PAUSED", "PREMIUM", 1],
      ["dado de baja por moderación", NEAR, 10, "REMOVED", "PREMIUM", 1],
      ["de un comercio con Premium vencido", NEAR, 10, "ACTIVE", "PREMIUM", -1],
      ["de un comercio FREE", NEAR, 10, "ACTIVE", "FREE", 1],
    ] as const)("no sirve como segmentado un anuncio %s", async (_label, point, radius, status, plan, months) => {
      const business = await createBusiness("excluded", point, plan, addMonths(new Date(), months));
      const ad = await createAd(business.id, radius, status);
      const report = await createReport(ORIGIN);

      const res = await getAd({ placement: "report_detail", reportId: report.id });

      expect(res.status).toBe(200);
      expect(res.body?.id === ad.id && res.body?.segmented).toBeFalsy();
      if (status !== "ACTIVE" || plan === "FREE" || months < 0) {
        expect(res.body?.id).not.toBe(ad.id);
      }
    });

    test("sin anuncios en el radio sirve uno sin segmentar", async () => {
      const business = await createBusiness("far", FAR);
      await createAd(business.id, 1);
      const report = await createReport(ORIGIN);

      const res = await getAd({ placement: "report_detail", reportId: report.id });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ segmented: false });
    });

    test("un reporte que no es público responde 404", async () => {
      const report = await createReport(ORIGIN, "pending");

      expect((await getAd({ placement: "report_detail", reportId: report.id })).status).toBe(404);
    });

    test("sin reportId responde 400", async () => {
      expect((await getAd({ placement: "report_detail" })).status).toBe(400);
    });
  });

  describe("GET /api/ads?placement=feed", () => {
    test("con ubicación consentida segmenta por la ubicación del usuario", async () => {
      const business = await createBusiness("feed-near", NEAR);
      const ad = await createAd(business.id, 10);
      await setViewerLocation(ORIGIN);

      const res = await getAd({ placement: "feed" }, viewerToken);

      expect(res.body).toMatchObject({ id: ad.id, segmented: true });
    });

    test("sin ubicación compartida igual recibe un anuncio, sin segmentar", async () => {
      const business = await createBusiness("feed-any", NEAR);
      await createAd(business.id, 10);

      const anonymous = await getAd({ placement: "feed" });
      const withoutConsent = await getAd({ placement: "feed" }, viewerToken);

      expect(anonymous.body).toMatchObject({ segmented: false });
      expect(withoutConsent.body).toMatchObject({ segmented: false });
    });

    test("con el consentimiento revocado deja de segmentar", async () => {
      const business = await createBusiness("feed-revoked", NEAR);
      await createAd(business.id, 10);
      await setViewerLocation(ORIGIN);
      await prisma.notificationPreference.update({ where: { userId: viewerId }, data: { locationConsentStatus: "declined" } });

      const res = await getAd({ placement: "feed" }, viewerToken);

      expect(res.body).toMatchObject({ segmented: false });
    });

    test("indica si el anuncio es del propio usuario (para no ofrecerle denunciarlo)", async () => {
      const business = await createBusiness("feed-own", NEAR);
      const ad = await createAd(business.id, 10);
      const owner = await prisma.user.findUniqueOrThrow({ where: { id: business.userId } });
      const ownerToken = signAccessToken(owner);
      await setViewerLocation(ORIGIN);

      const forViewer = await getAd({ placement: "feed" }, viewerToken);
      const forOwner = await getAd({ placement: "feed" });

      expect(forViewer.body).toMatchObject({ id: ad.id, isOwn: false });
      expect(forOwner.body.isOwn).toBe(false);
      const ownView = await request(app)
        .get("/api/ads")
        .query({ placement: "report_detail", reportId: (await createReport(ORIGIN)).id })
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(ownView.body).toMatchObject({ id: ad.id, isOwn: true });
    });

    test("el vencimiento se compara en UTC aunque la sesión de Postgres use otra zona", async () => {
      const business = await createBusiness("feed-tz", NEAR, "PREMIUM", new Date(Date.now() - 60 * 60 * 1000));
      await createAd(business.id, 10);
      await setViewerLocation(ORIGIN);

      // con la sesión en UTC-3, comparar contra now() sin pasar a UTC daría el plan por vigente
      const [row] = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'America/Argentina/Buenos_Aires'");
        return tx.$queryRaw<{ active: boolean }[]>`
          SELECT ${isPremiumActive} AS active FROM businesses b WHERE b.id = ${business.id}
        `;
      });

      expect(row.active).toBe(false);
    });

    test("un placement desconocido responde 400", async () => {
      expect((await getAd({ placement: "flyer" })).status).toBe(400);
    });
  });

  describe("GET /api/reports/:id/nearby-businesses", () => {
    test("lista los comercios cercanos: Premium primero y el resto por distancia", async () => {
      const freeNear = await createBusiness("list-free-near", { lat: -54.79, lng: -68.303 }, "FREE", null);
      const freeFar = await createBusiness("list-free-far", NEAR, "FREE", null);
      const premiumFar = await createBusiness("list-premium-far", { lat: -54.70, lng: -68.303 });
      const expired = await createBusiness("list-expired", { lat: -54.795, lng: -68.303 }, "PREMIUM", new Date(Date.now() - 1000));
      const outOfRange = await createBusiness("list-out-of-range", FAR, "PREMIUM");
      const noLocation = await createBusiness("list-no-location", null, "PREMIUM");
      const report = await createReport(ORIGIN);

      const res = await request(app).get(`/api/reports/${report.id}/nearby-businesses`);

      expect(res.status).toBe(200);
      // solo los comercios de este test: la base local puede tener otros cerca
      const own = new Set([freeNear.id, freeFar.id, premiumFar.id, expired.id, outOfRange.id, noLocation.id]);
      const items = res.body.filter((item: { id: number }) => own.has(item.id));
      const ids = items.map((item: { id: number }) => item.id);
      // premiumFar ~11 km, expired ~0,8 km, freeNear ~1,3 km, freeFar ~5,5 km
      expect(ids).toEqual([premiumFar.id, expired.id, freeNear.id, freeFar.id]);
      expect(items[0]).toMatchObject({ featured: true, name: premiumFar.name });
      expect(items[1]).toMatchObject({ featured: false });
      expect(items[2]).toMatchObject({ featured: false });
      expect(items[2].distanceKm).toBeCloseTo(1.3, 1);
      expect(items[0]).not.toHaveProperty("cuit");
    });

    test("un reporte sin ubicación devuelve una lista vacía", async () => {
      await createBusiness("list-any", ORIGIN);
      const report = await createReport(null);

      const res = await request(app).get(`/api/reports/${report.id}/nearby-businesses`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test("un reporte que no es público responde 404", async () => {
      const report = await createReport(ORIGIN, "pending");

      expect((await request(app).get(`/api/reports/${report.id}/nearby-businesses`)).status).toBe(404);
    });
  });

  test("GET /api/businesses muestra primero los Premium vigentes", async () => {
    const free = await createBusiness("dir-aaa-free", ORIGIN, "FREE", null);
    const premium = await createBusiness("dir-zzz-premium", ORIGIN);

    const res = await request(app).get("/api/businesses");
    const ids = res.body.map((item: { id: number }) => item.id);
    const lastPremium = Math.max(...res.body.map((item: { plan: string }, i: number) => (item.plan === "PREMIUM" ? i : -1)));
    const firstFree = res.body.findIndex((item: { plan: string }) => item.plan === "FREE");

    expect(ids.indexOf(premium.id)).toBeLessThan(ids.indexOf(free.id));
    expect(lastPremium).toBeLessThan(firstFree);
  });
});
