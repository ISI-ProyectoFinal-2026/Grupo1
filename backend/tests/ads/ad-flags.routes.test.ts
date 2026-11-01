import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { addMonths } from "../../src/services/business-plan";
import { createTestUser } from "../helpers/users";

describe("denuncias de anuncios", () => {
  const userIds: number[] = [];
  let ownerId: number;
  let ownerToken: string;
  let reporterToken: string;
  let secondReporterToken: string;
  let moderatorToken: string;
  let adId: number;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const flagAd = (id: number, token: string, reason = "Contenido engañoso") =>
    request(app).post(`/api/ads/${id}/flags`).set(auth(token)).send({ reason });
  const resolve = (flagId: number, action: string, token = moderatorToken) =>
    request(app).patch(`/api/ad-flags/${flagId}`).set(auth(token)).send({ action });

  beforeAll(async () => {
    const owner = await createTestUser({ prefix: "ad-flags-owner" });
    const reporter = await createTestUser({ prefix: "ad-flags-reporter" });
    const second = await createTestUser({ prefix: "ad-flags-second" });
    const moderator = await createTestUser({ prefix: "ad-flags-moderator", role: "moderador" });
    ownerId = owner.user.id;
    ownerToken = owner.token;
    reporterToken = reporter.token;
    secondReporterToken = second.token;
    moderatorToken = moderator.token;
    userIds.push(owner.user.id, reporter.user.id, second.user.id, moderator.user.id);
  });

  beforeEach(async () => {
    const business = await prisma.business.create({
      data: {
        userId: ownerId,
        name: "Comercio denunciado",
        cuit: `ad-flags-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        address: "x",
        phone: "1",
        category: "PET_SHOP",
        latitude: -34.6,
        longitude: -68.33,
        plan: "PREMIUM",
        planExpiresAt: addMonths(new Date(), 1),
      },
    });
    const ad = await prisma.ad.create({
      data: { businessId: business.id, title: "Oferta", body: "x", imageUrl: "https://pub-test.r2.dev/a.jpg", radiusKm: 5 },
    });
    adId = ad.id;
  });

  afterEach(async () => {
    await prisma.business.deleteMany({ where: { userId: ownerId } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  describe("POST /api/ads/:adId/flags", () => {
    test("un usuario denuncia un anuncio y queda pendiente", async () => {
      const res = await flagAd(adId, reporterToken);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ adId, reason: "Contenido engañoso", status: "pending" });
    });

    test("no se puede denunciar dos veces el mismo anuncio (409)", async () => {
      await flagAd(adId, reporterToken);

      expect((await flagAd(adId, reporterToken)).status).toBe(409);
    });

    test("el dueño no puede denunciar su propio anuncio (403)", async () => {
      expect((await flagAd(adId, ownerToken)).status).toBe(403);
    });

    test("sin motivo responde 400", async () => {
      expect((await flagAd(adId, reporterToken, "   ")).status).toBe(400);
    });

    test("sin sesión responde 401", async () => {
      expect((await request(app).post(`/api/ads/${adId}/flags`).send({ reason: "x" })).status).toBe(401);
    });

    test("un anuncio que no se está mostrando no se puede denunciar (404)", async () => {
      await prisma.ad.update({ where: { id: adId }, data: { status: "PAUSED" } });

      expect((await flagAd(adId, reporterToken)).status).toBe(404);
    });
  });

  describe("GET /api/ad-flags", () => {
    test("un moderador ve la cola de pendientes con el anuncio y el comercio", async () => {
      const flag = await flagAd(adId, reporterToken);

      const res = await request(app).get("/api/ad-flags").set(auth(moderatorToken));

      expect(res.status).toBe(200);
      const found = res.body.find((item: { id: number }) => item.id === flag.body.id);
      expect(found).toMatchObject({
        status: "pending",
        ad: { id: adId, title: "Oferta", status: "ACTIVE", business: { name: "Comercio denunciado" } },
      });
    });

    test("un usuario común recibe 403", async () => {
      expect((await request(app).get("/api/ad-flags").set(auth(reporterToken))).status).toBe(403);
    });
  });

  describe("PATCH /api/ad-flags/:id", () => {
    test("dar de baja oculta el anuncio y cierra las demás denuncias pendientes", async () => {
      const first = await flagAd(adId, reporterToken);
      const second = await flagAd(adId, secondReporterToken);

      const res = await resolve(first.body.id, "remove");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "removed", ad: { status: "REMOVED" } });
      const other = await prisma.adFlag.findUniqueOrThrow({ where: { id: second.body.id } });
      expect(other.status).toBe("removed");
      const pending = await request(app).get("/api/ad-flags").set(auth(moderatorToken));
      expect(pending.body.map((item: { id: number }) => item.id)).not.toContain(second.body.id);
    });

    test("desestimar cierra solo esa denuncia y el anuncio sigue activo", async () => {
      const first = await flagAd(adId, reporterToken);
      const second = await flagAd(adId, secondReporterToken);

      const res = await resolve(first.body.id, "dismiss");

      expect(res.body).toMatchObject({ status: "dismissed", ad: { status: "ACTIVE" } });
      expect((await prisma.adFlag.findUniqueOrThrow({ where: { id: second.body.id } })).status).toBe("pending");
    });

    test("una denuncia ya resuelta responde 409", async () => {
      const flag = await flagAd(adId, reporterToken);
      await resolve(flag.body.id, "dismiss");

      expect((await resolve(flag.body.id, "remove")).status).toBe(409);
    });

    test("dos moderadores a la vez: solo uno resuelve", async () => {
      const flag = await flagAd(adId, reporterToken);

      const results = await Promise.all([resolve(flag.body.id, "remove"), resolve(flag.body.id, "dismiss")]);

      expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    });

    test.each([
      ["una acción desconocida", "approve", 400],
      ["un usuario común", "remove", 403],
    ])("con %s responde %i", async (_label, action, status) => {
      const flag = await flagAd(adId, reporterToken);
      const token = status === 403 ? reporterToken : moderatorToken;

      expect((await resolve(flag.body.id, action, token)).status).toBe(status);
    });

    test("una denuncia inexistente responde 404", async () => {
      expect((await resolve(999999999, "remove")).status).toBe(404);
    });
  });
});
