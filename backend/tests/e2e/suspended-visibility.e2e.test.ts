import request from "supertest";
import { AccountSanctionStatus } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { sanctionClock } from "../../src/services/account-sanctions/clock";
import * as notificationsService from "../../src/services/notifications.service";
import { createE2EContext, E2EUser } from "./helpers/factories";

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-03-10T12:00:00.000Z");
const ENDS_AT = new Date(T0.getTime() + 14 * DAY_MS);
const AFTER_END = new Date(T0.getTime() + 15 * DAY_MS);
// punto aislado para que el anuncio segmentado no compita con restos de otras suites
const POINT = { lat: -54.8, lng: -68.3 };
const ZONE = "ZonaSuspendidaE2E";

describe("E2E: contenido de cuentas suspendidas oculto", () => {
  const ctx = createE2EContext("suspended-visibility");
  const auth = (user: E2EUser) => ({ Authorization: `Bearer ${user.token}` });

  let author: E2EUser;
  let viewer: E2EUser;
  let authorReportId: number;
  let viewerReportId: number;
  let businessId: number;
  let adId: number;
  let matchId: number;
  let chatId: number;

  const setClock = (now: Date) => jest.spyOn(sanctionClock, "now").mockReturnValue(now);

  const suspend = (
    { status = "active", endsAt = ENDS_AT }: { status?: AccountSanctionStatus; endsAt?: Date | null } = {}
  ) =>
    prisma.accountSanction.create({
      data: {
        userId: author.id,
        severity: "mild",
        kind: endsAt ? "temporary" : "permanent",
        status,
        reason: "motivo",
        triggeringReportIds: [],
        startsAt: T0,
        endsAt,
      },
    });

  // visible antes, oculto mientras dura, visible cuando vence
  async function expectHiddenWhileSuspended(read: () => Promise<boolean>) {
    setClock(T0);
    expect(await read()).toBe(true);
    await suspend();
    expect(await read()).toBe(false);
    setClock(AFTER_END);
    expect(await read()).toBe(true);
  }

  async function insertReport(userId: number, reportType: "lost" | "found", extra: { zone?: string } = {}) {
    const report = await prisma.report.create({
      data: { userId, reportType, status: "published", title: "Reporte e2e", locationAddress: extra.zone ?? null },
    });
    await prisma.$executeRaw`
      UPDATE reports SET location = ST_SetSRID(ST_MakePoint(${POINT.lng}, ${POINT.lat}), 4326) WHERE id = ${report.id}
    `;
    return report.id;
  }

  beforeAll(async () => {
    author = await ctx.registerAndLogin("author");
    viewer = await ctx.registerAndLogin("viewer");
    authorReportId = await insertReport(author.id, "lost", { zone: ZONE });
    viewerReportId = await insertReport(viewer.id, "found");
    await prisma.report.update({
      where: { id: authorReportId },
      data: { customFlyerUrl: "https://pub-e2e.r2.dev/flyers/e2e.png" },
    });

    const business = await prisma.business.create({
      data: {
        userId: author.id,
        name: "Comercio suspendido e2e",
        cuit: `susp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        address: "Calle 1",
        phone: "1",
        category: "VETERINARIA",
        latitude: POINT.lat,
        longitude: POINT.lng,
        plan: "PREMIUM",
        planExpiresAt: new Date(Date.now() + 400 * DAY_MS),
      },
    });
    businessId = business.id;
    const ad = await prisma.ad.create({
      data: { businessId, title: "Promo", body: "Texto", imageUrl: "https://pub-e2e.r2.dev/ad.jpg", radiusKm: 1 },
    });
    adId = ad.id;

    const match = await prisma.reportMatch.create({
      data: { reportLostId: authorReportId, reportFoundId: viewerReportId, similarityScore: 0.9 },
    });
    matchId = match.id;

    const [userAId, userBId] = [author.id, viewer.id].sort((a, b) => a - b);
    chatId = (await prisma.chat.create({ data: { userAId, userBId, reportId: authorReportId } })).id;

    await prisma.notificationPreference.upsert({
      where: { userId: viewer.id },
      create: { userId: viewer.id, locationConsentStatus: "accepted", locationConsentAt: new Date() },
      update: { locationConsentStatus: "accepted" },
    });
    await prisma.$executeRaw`
      UPDATE notification_preferences
      SET location = ST_SetSRID(ST_MakePoint(${POINT.lng}, ${POINT.lat}), 4326), location_updated_at = now()
      WHERE user_id = ${viewer.id}
    `;
  }, 60_000);

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.accountSanction.deleteMany({ where: { userId: author.id } });
    await prisma.notification.deleteMany({ where: { userId: viewer.id } });
  });

  afterAll(async () => {
    await ctx.cleanup();
    await prisma.$disconnect();
  });

  test("GET /api/reports no lista los reportes del autor suspendido", async () => {
    await expectHiddenWhileSuspended(async () => {
      const res = await request(app).get("/api/reports").query({ zone: ZONE }).set(auth(viewer));
      return res.status === 200 && res.body.some((r: { id: number }) => r.id === authorReportId);
    });
  });

  test("GET /api/reports/:id devuelve 404 a un tercero y a un anónimo", async () => {
    await expectHiddenWhileSuspended(async () => {
      const res = await request(app).get(`/api/reports/${authorReportId}`).set(auth(viewer));
      return res.status === 200;
    });
    await prisma.accountSanction.deleteMany({ where: { userId: author.id } });
    setClock(T0);
    await suspend();
    expect((await request(app).get(`/api/reports/${authorReportId}`)).status).toBe(404);
  });

  test("GET /api/reports/:id/flyer devuelve 404 mientras el autor está suspendido", async () => {
    await expectHiddenWhileSuspended(async () => {
      const res = await request(app).get(`/api/reports/${authorReportId}/flyer`).set(auth(viewer));
      return res.status === 200;
    });
  });

  test("GET /api/geo/nearby y /api/geo/map excluyen al autor suspendido", async () => {
    const nearby = async () => {
      const res = await request(app).get("/api/geo/nearby").query({ ...POINT, radius: 5 });
      return res.status === 200 && res.body.some((r: { id: number }) => r.id === authorReportId);
    };
    const bounds = `${POINT.lat - 0.1},${POINT.lng - 0.1},${POINT.lat + 0.1},${POINT.lng + 0.1}`;
    const map = async () => {
      const res = await request(app).get("/api/geo/map").query({ bounds });
      return res.status === 200 && res.body.some((r: { id: number }) => r.id === authorReportId);
    };

    await expectHiddenWhileSuspended(nearby);
    await prisma.accountSanction.deleteMany({ where: { userId: author.id } });
    await expectHiddenWhileSuspended(map);
  });

  test("POST /api/reports/similar no sugiere reportes del autor suspendido", async () => {
    await expectHiddenWhileSuspended(async () => {
      const res = await request(app)
        .post("/api/reports/similar")
        .set(auth(viewer))
        .send({ reportType: "lost", location: POINT });
      return res.status === 200 && res.body.some((r: { id: number }) => r.id === authorReportId);
    });
  });

  test("GET /api/reports/:id/matches no sugiere el reporte del autor suspendido", async () => {
    await expectHiddenWhileSuspended(async () => {
      const res = await request(app).get(`/api/reports/${viewerReportId}/matches`).set(auth(viewer));
      return res.status === 200 && res.body.some((m: { matchId: number }) => m.matchId === matchId);
    });
  });

  test("GET /api/reports/:id/matches del reporte del autor suspendido devuelve vacío", async () => {
    await expectHiddenWhileSuspended(async () => {
      const res = await request(app).get(`/api/reports/${authorReportId}/matches`).set(auth(viewer));
      return res.status === 200 && res.body.length > 0;
    });
  });

  test("notifyMatch no avisa del reporte de un autor suspendido", async () => {
    await expectHiddenWhileSuspended(async () => {
      await prisma.notification.deleteMany({ where: { userId: { in: [viewer.id, author.id] } } });
      const result = await notificationsService.notifyMatch({
        lostReportId: authorReportId,
        foundReportId: viewerReportId,
        similarityScore: 0.9,
      });
      return result.length > 0;
    });
  });

  test("createForNearbyReport no avisa del reporte de un autor suspendido", async () => {
    await expectHiddenWhileSuspended(async () => {
      await prisma.notification.deleteMany({ where: { userId: viewer.id } });
      const result = await notificationsService.createForNearbyReport(authorReportId);
      return result.length > 0;
    });
  });

  test("GET /api/ads no sirve el anuncio del comercio suspendido", async () => {
    await expectHiddenWhileSuspended(async () => {
      const res = await request(app)
        .get("/api/ads")
        .query({ placement: "report_detail", reportId: viewerReportId })
        .set(auth(viewer));
      return res.status === 200 && res.body?.id === adId;
    });
  });

  test("POST /api/ads/:adId/events devuelve 404 para el anuncio suspendido", async () => {
    await expectHiddenWhileSuspended(async () => {
      const res = await request(app)
        .post(`/api/ads/${adId}/events`)
        .set(auth(viewer))
        .send({ type: "impression", placement: "feed" });
      return res.status === 204;
    });
  });

  test("GET /api/reports/:id/nearby-businesses no lista el comercio suspendido", async () => {
    await expectHiddenWhileSuspended(async () => {
      const res = await request(app).get(`/api/reports/${viewerReportId}/nearby-businesses`).set(auth(viewer));
      return res.status === 200 && res.body.some((b: { id: number }) => b.id === businessId);
    });
  });

  test("GET /api/businesses no lista el comercio suspendido", async () => {
    await expectHiddenWhileSuspended(async () => {
      const res = await request(app).get("/api/businesses").query({ category: "VETERINARIA" });
      return res.status === 200 && res.body.some((b: { id: number }) => b.id === businessId);
    });
  });

  test("GET /api/businesses/:id devuelve 404 para el comercio suspendido", async () => {
    await expectHiddenWhileSuspended(async () => {
      const res = await request(app).get(`/api/businesses/${businessId}`).set(auth(viewer));
      return res.status === 200;
    });
  });

  test("POST /api/businesses/:id/contact devuelve 404 para el comercio suspendido", async () => {
    await expectHiddenWhileSuspended(async () => {
      const res = await request(app).post(`/api/businesses/${businessId}/contact`).set(auth(viewer));
      return res.status === 204;
    });
  });

  test("revertida, descartada o en revisión de staff no oculta; la permanente sí", async () => {
    const visible = async () => {
      const res = await request(app).get(`/api/reports/${authorReportId}`).set(auth(viewer));
      return res.status === 200;
    };
    setClock(T0);

    for (const status of ["reverted", "dismissed", "expired", "pending_review"] as const) {
      await suspend({ status });
      expect(await visible()).toBe(true);
      await prisma.accountSanction.deleteMany({ where: { userId: author.id } });
    }

    await suspend({ endsAt: null });
    expect(await visible()).toBe(false);
    setClock(new Date(T0.getTime() + 3650 * DAY_MS));
    expect(await visible()).toBe(false);
  });

  test("los chats existentes no cambian mientras el autor está suspendido", async () => {
    setClock(T0);
    await suspend();

    const res = await request(app).get("/api/chats").set(auth(viewer));

    expect(res.status).toBe(200);
    expect(res.body.map((c: { id: number }) => c.id)).toContain(chatId);
  });
});
