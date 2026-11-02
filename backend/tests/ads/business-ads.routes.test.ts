import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { addMonths } from "../../src/services/business-plan";

const R2_PUBLIC_URL = "https://pub-test.r2.dev";

describe("/api/businesses/me/ads", () => {
  let ownerId: number;
  let ownerToken: string;
  let otherId: number;
  let otherToken: string;
  let businessId: number;

  const adInput = {
    title: "Vacunación antirrábica",
    body: "Todo noviembre con 20% de descuento.",
    imageUrl: `${R2_PUBLIC_URL}/uploads/vacuna.jpg`,
    radiusKm: 5,
  };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function createUser(label: string, verified = true) {
    const user = await prisma.user.create({
      data: {
        email: `ads-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        passwordHash: "x",
        emailVerifiedAt: verified ? new Date() : null,
      },
    });
    return { id: user.id, token: jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" }) };
  }

  async function setPlan(plan: "FREE" | "PREMIUM", planExpiresAt: Date | null) {
    await prisma.business.update({ where: { id: businessId }, data: { plan, planExpiresAt } });
  }

  const postAd = (body: object = adInput, token = ownerToken) =>
    request(app).post("/api/businesses/me/ads").set(auth(token)).send(body);

  beforeAll(async () => {
    process.env.R2_PUBLIC_URL = R2_PUBLIC_URL;
    ({ id: ownerId, token: ownerToken } = await createUser("owner"));
    ({ id: otherId, token: otherToken } = await createUser("other"));
  });

  beforeEach(async () => {
    const business = await prisma.business.create({
      data: {
        userId: ownerId,
        name: "Veterinaria Ads",
        cuit: `ads-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        address: "Calle 1",
        phone: "123",
        category: "VETERINARIA",
        latitude: -34.6,
        longitude: -68.33,
        plan: "PREMIUM",
        planExpiresAt: addMonths(new Date(), 1),
      },
    });
    businessId = business.id;
  });

  afterEach(async () => {
    await prisma.business.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await prisma.$disconnect();
  });

  describe("POST", () => {
    test("un comercio Premium crea un anuncio activo", async () => {
      const res = await postAd();

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ ...adInput, businessId, status: "ACTIVE" });
    });

    test("un comercio FREE no puede crear anuncios (403 PREMIUM_REQUIRED)", async () => {
      await setPlan("FREE", null);

      const res = await postAd();

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("PREMIUM_REQUIRED");
    });

    test("un Premium vencido no puede crear anuncios", async () => {
      await setPlan("PREMIUM", new Date(Date.now() - 1000));

      expect((await postAd()).status).toBe(403);
    });

    test("sin ubicación cargada en el mapa responde 409 BUSINESS_LOCATION_REQUIRED", async () => {
      await prisma.business.update({ where: { id: businessId }, data: { latitude: null, longitude: null } });

      const res = await postAd();

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("BUSINESS_LOCATION_REQUIRED");
    });

    test("el cuarto anuncio activo responde 409 AD_LIMIT_REACHED", async () => {
      for (let i = 0; i < 3; i++) {
        expect((await postAd()).status).toBe(201);
      }

      const res = await postAd();

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("AD_LIMIT_REACHED");
    });

    test("con creaciones simultáneas nunca pasa de 3 activos", async () => {
      const results = await Promise.all(Array.from({ length: 5 }, () => postAd()));

      expect(results.filter((res) => res.status === 201)).toHaveLength(3);
      expect(await prisma.ad.count({ where: { businessId, status: "ACTIVE" } })).toBe(3);
    });

    test("los anuncios pausados no cuentan para el límite", async () => {
      for (let i = 0; i < 3; i++) {
        await postAd();
      }
      const first = await prisma.ad.findFirstOrThrow({ where: { businessId } });
      await prisma.ad.update({ where: { id: first.id }, data: { status: "PAUSED" } });

      expect((await postAd()).status).toBe(201);
    });

    test.each([
      ["radio 0", { radiusKm: 0 }],
      ["radio 21", { radiusKm: 21 }],
      ["radio con decimales", { radiusKm: 2.5 }],
      ["título vacío", { title: "  " }],
      ["título de más de 60", { title: "a".repeat(61) }],
      ["texto de más de 200", { body: "a".repeat(201) }],
      ["imagen fuera del bucket", { imageUrl: "https://evil.com/x.jpg" }],
    ])("rechaza %s con 400", async (_label, override) => {
      expect((await postAd({ ...adInput, ...override })).status).toBe(400);
    });

    test("sin email verificado responde 403", async () => {
      const unverified = await createUser("unverified", false);
      try {
        expect((await postAd(adInput, unverified.token)).status).toBe(403);
      } finally {
        await prisma.user.delete({ where: { id: unverified.id } });
      }
    });

    test("sin sesión responde 401", async () => {
      expect((await request(app).post("/api/businesses/me/ads").send(adInput)).status).toBe(401);
    });

    test("un usuario sin comercio recibe 404", async () => {
      expect((await postAd(adInput, otherToken)).status).toBe(404);
    });
  });

  describe("GET", () => {
    test("lista solo los anuncios del comercio propio, del más nuevo al más viejo", async () => {
      const first = await postAd({ ...adInput, title: "Primero" });
      const second = await postAd({ ...adInput, title: "Segundo" });

      const res = await request(app).get("/api/businesses/me/ads").set(auth(ownerToken));

      expect(res.status).toBe(200);
      expect(res.body.map((ad: { id: number }) => ad.id)).toEqual([second.body.id, first.body.id]);
    });
  });

  describe("PUT /:adId", () => {
    test("edita el contenido del anuncio", async () => {
      const created = await postAd();

      const res = await request(app)
        .put(`/api/businesses/me/ads/${created.body.id}`)
        .set(auth(ownerToken))
        .send({ title: "Nuevo título", radiusKm: 15 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ title: "Nuevo título", radiusKm: 15, body: adInput.body });
    });

    test("el anuncio de otro comercio responde 404", async () => {
      const created = await postAd();
      const other = await prisma.business.create({
        data: { userId: otherId, name: "Otro", cuit: `ads-other-${Date.now()}`, address: "x", phone: "1", category: "OTRO" },
      });
      expect(other.id).toBeDefined();

      const res = await request(app)
        .put(`/api/businesses/me/ads/${created.body.id}`)
        .set(auth(otherToken))
        .send({ title: "Robado" });

      expect(res.status).toBe(404);
    });

    test("un anuncio dado de baja por moderación no se puede editar (409)", async () => {
      const created = await postAd();
      await prisma.ad.update({ where: { id: created.body.id }, data: { status: "REMOVED" } });

      const res = await request(app)
        .put(`/api/businesses/me/ads/${created.body.id}`)
        .set(auth(ownerToken))
        .send({ title: "Otra vez" });

      expect(res.status).toBe(409);
    });
  });

  describe("PATCH /:adId/status", () => {
    const setStatus = (adId: number, status: string) =>
      request(app).patch(`/api/businesses/me/ads/${adId}/status`).set(auth(ownerToken)).send({ status });

    test("pausa y reactiva un anuncio", async () => {
      const created = await postAd();

      expect((await setStatus(created.body.id, "PAUSED")).body.status).toBe("PAUSED");
      expect((await setStatus(created.body.id, "ACTIVE")).body.status).toBe("ACTIVE");
    });

    test("reactivar respeta el límite de 3 activos", async () => {
      const paused = await postAd();
      await setStatus(paused.body.id, "PAUSED");
      for (let i = 0; i < 3; i++) {
        await postAd();
      }

      const res = await setStatus(paused.body.id, "ACTIVE");

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("AD_LIMIT_REACHED");
    });

    test("reactivar exige Premium vigente", async () => {
      const created = await postAd();
      await setStatus(created.body.id, "PAUSED");
      await setPlan("PREMIUM", new Date(Date.now() - 1000));

      expect((await setStatus(created.body.id, "ACTIVE")).status).toBe(403);
    });

    test("el dueño no puede marcar un anuncio como REMOVED (400)", async () => {
      const created = await postAd();

      expect((await setStatus(created.body.id, "REMOVED")).status).toBe(400);
    });

    test("un anuncio dado de baja por moderación no se puede reactivar (409)", async () => {
      const created = await postAd();
      await prisma.ad.update({ where: { id: created.body.id }, data: { status: "REMOVED" } });

      expect((await setStatus(created.body.id, "ACTIVE")).status).toBe(409);
    });
  });

  describe("DELETE /:adId", () => {
    test("elimina el anuncio propio", async () => {
      const created = await postAd();

      const res = await request(app).delete(`/api/businesses/me/ads/${created.body.id}`).set(auth(ownerToken));

      expect(res.status).toBe(204);
      expect(await prisma.ad.findUnique({ where: { id: created.body.id } })).toBeNull();
    });

    test("un id inexistente responde 404", async () => {
      expect((await request(app).delete("/api/businesses/me/ads/999999999").set(auth(ownerToken))).status).toBe(404);
    });
  });

  test("borrar el comercio elimina en cascada sus anuncios", async () => {
    const created = await postAd();

    await prisma.business.delete({ where: { id: businessId } });

    expect(await prisma.ad.findUnique({ where: { id: created.body.id } })).toBeNull();
  });
});
