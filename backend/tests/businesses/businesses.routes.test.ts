import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

describe("POST/GET/PUT /api/businesses", () => {
  let userId: number;
  let token: string;
  let otherUserId: number;
  let otherToken: string;
  const createdBusinessIds: number[] = [];

  const baseBusinessData = {
    name: "Refugio Patitas Felices",
    address: "Ruta 8 km 45",
    phone: "1133445566",
    category: "REFUGIO",
    location: { lat: -34.6251, lng: -68.3221 },
  };

  function uniqueCuit(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  beforeAll(async () => {
    // Registrar un comercio exige el email verificado; el dueño de los tests lo tiene.
    const user = await prisma.user.create({
      data: {
        email: `businesses-routes-test-${Date.now()}@example.com`,
        passwordHash: "test-hash",
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;
    token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    // Sin verificar a propósito: el resto de la app (ver, contactar) no lo exige.
    const otherUser = await prisma.user.create({
      data: { email: `businesses-routes-test-other-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    otherUserId = otherUser.id;
    otherToken = jwt.sign({ sub: otherUser.id, email: otherUser.email }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });
  });

  afterEach(async () => {
    while (createdBusinessIds.length > 0) {
      const id = createdBusinessIds.pop()!;
      await prisma.business.deleteMany({ where: { id } });
    }
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: otherUserId } });
    await prisma.$disconnect();
  });

  test("POST /api/businesses crea el comercio y lo vincula al usuario autenticado", async () => {
    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(userId);
    expect(res.body.name).toBe(baseBusinessData.name);
    createdBusinessIds.push(res.body.id);
  });

  test("POST /api/businesses con el email sin verificar también crea el comercio (ya no se gatea)", async () => {
    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(otherUserId);
    createdBusinessIds.push(res.body.id);
  });

  test("POST /api/businesses sin token responde 401", async () => {
    const res = await request(app).post("/api/businesses").send(baseBusinessData);
    expect(res.status).toBe(401);
  });

  test("POST /api/businesses responde 400 si el body es inválido", async () => {
    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sin más datos" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("POST /api/businesses guarda las coordenadas del pin del mapa", async () => {
    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });

    expect(res.status).toBe(201);
    expect(res.body.latitude).toBeCloseTo(-34.6251, 5);
    expect(res.body.longitude).toBeCloseTo(-68.3221, 5);
    createdBusinessIds.push(res.body.id);
  });

  test("POST /api/businesses responde 400 si las coordenadas están fuera de rango", async () => {
    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit(), location: { lat: -95, lng: -68.3221 } });

    expect(res.status).toBe(400);
  });

  test("POST /api/businesses responde 400 si falta la ubicación", async () => {
    const { location: _omitted, ...withoutLocation } = baseBusinessData;
    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...withoutLocation, cuit: uniqueCuit() });

    expect(res.status).toBe(400);
  });

  test("POST /api/businesses ignora el plan: no se puede auto-otorgar PREMIUM", async () => {
    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit(), plan: "PREMIUM" });

    expect(res.status).toBe(201);
    expect(res.body.plan).toBe("FREE");
    createdBusinessIds.push(res.body.id);
  });

  test("POST /api/businesses sin plan crea el comercio como FREE", async () => {
    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });

    expect(res.status).toBe(201);
    expect(res.body.plan).toBe("FREE");
    createdBusinessIds.push(res.body.id);
  });

  test("POST /api/businesses ignora el plan PRO y crea el comercio como FREE", async () => {
    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit(), plan: "PRO" });

    expect(res.status).toBe(201);
    expect(res.body.plan).toBe("FREE");
    createdBusinessIds.push(res.body.id);
  });

  test("GET /api/businesses/me retorna los datos del comercio del usuario logueado", async () => {
    const created = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(created.body.id);

    const res = await request(app).get("/api/businesses/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.userId).toBe(userId);
  });

  test("GET /api/businesses/me responde 404 si el usuario no tiene comercio registrado", async () => {
    const res = await request(app).get("/api/businesses/me").set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  test("GET /api/businesses/me sin token responde 401", async () => {
    const res = await request(app).get("/api/businesses/me");
    expect(res.status).toBe(401);
  });

  test("POST /api/businesses guarda descripción y enlaces, y el perfil público los muestra", async () => {
    const profile = {
      description: "Atención 24 hs y guardia de emergencias.",
      website: "https://vetsanroque.com.ar",
      socialLinks: ["https://instagram.com/vetsanroque", "https://facebook.com/vetsanroque"],
    };
    const created = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit(), ...profile });
    createdBusinessIds.push(created.body.id);

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject(profile);

    const res = await request(app).get(`/api/businesses/${created.body.id}`);
    expect(res.body).toMatchObject(profile);
  });

  test("POST /api/businesses sin descripción ni enlaces los deja vacíos", async () => {
    const created = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(created.body.id);

    expect(created.body).toMatchObject({ description: null, website: null, socialLinks: [] });
  });

  test("PUT /api/businesses/me edita y borra la descripción y los enlaces", async () => {
    const created = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit(), description: "Vieja", website: "https://viejo.com" });
    createdBusinessIds.push(created.body.id);

    const updated = await request(app)
      .put("/api/businesses/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "Nueva", socialLinks: ["https://instagram.com/nuevo"] });
    expect(updated.body).toMatchObject({
      description: "Nueva",
      website: "https://viejo.com",
      socialLinks: ["https://instagram.com/nuevo"],
    });

    const cleared = await request(app)
      .put("/api/businesses/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "   ", website: null, socialLinks: [] });
    expect(cleared.body).toMatchObject({ description: null, website: null, socialLinks: [] });
  });

  test.each([
    ["un enlace con javascript:", { website: "javascript:alert(1)" }],
    ["una red con data:", { socialLinks: ["data:text/html,<script>alert(1)</script>"] }],
    ["un texto que no es URL", { website: "mi sitio" }],
    ["más de 5 redes", { socialLinks: Array.from({ length: 6 }, (_, i) => `https://red${i}.com`) }],
    ["una descripción de más de 500 caracteres", { description: "a".repeat(501) }],
    ["una URL de más de 300 caracteres", { website: `https://a.com/${"a".repeat(300)}` }],
  ])("PUT /api/businesses/me rechaza %s con 400", async (_label, body) => {
    const created = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(created.body.id);

    const res = await request(app).put("/api/businesses/me").set("Authorization", `Bearer ${token}`).send(body);

    expect(res.status).toBe(400);
  });

  test("PUT /api/businesses/me actualiza los datos del comercio", async () => {
    const created = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(created.body.id);

    const res = await request(app)
      .put("/api/businesses/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "1199998888" });

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe("1199998888");
  });

  test("PUT /api/businesses/me ignora el plan: no se puede auto-otorgar PREMIUM", async () => {
    const created = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(created.body.id);
    expect(created.body.plan).toBe("FREE");

    const res = await request(app)
      .put("/api/businesses/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan: "PREMIUM" });

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe("FREE");
  });

  test("PUT /api/businesses/me ignora el cuit: la identidad fiscal no es editable", async () => {
    const originalCuit = uniqueCuit();
    const created = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: originalCuit });
    createdBusinessIds.push(created.body.id);

    const res = await request(app)
      .put("/api/businesses/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ cuit: uniqueCuit() });

    expect(res.status).toBe(200);
    expect(res.body.cuit).toBe(originalCuit);
  });

  test("PUT /api/businesses/me responde 404 si el usuario no tiene comercio registrado", async () => {
    const res = await request(app)
      .put("/api/businesses/me")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ phone: "123" });
    expect(res.status).toBe(404);
  });

  test("GET /api/businesses/me/stats devuelve estadísticas básicas", async () => {
    const created = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(created.body.id);

    const res = await request(app).get("/api/businesses/me/stats").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ views: expect.any(Number), contacts: expect.any(Number) });
  });

  test("GET /api/businesses/me/stats responde 404 si el usuario no tiene comercio registrado", async () => {
    const res = await request(app).get("/api/businesses/me/stats").set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  async function createBusiness(): Promise<{ id: number }> {
    const created = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(created.body.id);
    return created.body;
  }

  test("GET /api/businesses es público y no expone cuit ni userId", async () => {
    const business = await createBusiness();

    const res = await request(app).get("/api/businesses");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((item: { id: number }) => item.id === business.id);
    expect(found).toBeDefined();
    expect(found).not.toHaveProperty("cuit");
    expect(found).not.toHaveProperty("userId");
  });

  test("GET /api/businesses?category filtra por rubro", async () => {
    const business = await createBusiness();

    const same = await request(app).get("/api/businesses").query({ category: "REFUGIO" });
    const other = await request(app).get("/api/businesses").query({ category: "PET_SHOP" });

    expect(same.status).toBe(200);
    expect(same.body.some((item: { id: number }) => item.id === business.id)).toBe(true);
    expect(other.body.some((item: { id: number }) => item.id === business.id)).toBe(false);
  });

  test("GET /api/businesses responde 400 si la categoría es inválida", async () => {
    const res = await request(app).get("/api/businesses").query({ category: "NO_EXISTE" });
    expect(res.status).toBe(400);
  });

  test("GET /api/businesses/:id es público y registra la vista en las stats del dueño", async () => {
    const business = await createBusiness();

    const res = await request(app).get(`/api/businesses/${business.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(business.id);
    expect(res.body).not.toHaveProperty("cuit");

    const stats = await request(app).get("/api/businesses/me/stats").set("Authorization", `Bearer ${token}`);
    expect(stats.body).toEqual({ views: 1, contacts: 0 });
  });

  test("GET /api/businesses/:id no cuenta la visita del propio dueño", async () => {
    const business = await createBusiness();

    await request(app).get(`/api/businesses/${business.id}`).set("Authorization", `Bearer ${token}`);

    const stats = await request(app).get("/api/businesses/me/stats").set("Authorization", `Bearer ${token}`);
    expect(stats.body.views).toBe(0);
  });

  test("GET /api/businesses/:id responde 404 si el comercio no existe", async () => {
    const res = await request(app).get("/api/businesses/999999999");
    expect(res.status).toBe(404);
  });

  test("GET /api/businesses/me no se resuelve como /:id", async () => {
    const business = await createBusiness();

    const res = await request(app).get("/api/businesses/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(business.id);
    expect(res.body.cuit).toBeDefined();
  });

  test("POST /api/businesses/:id/contact sin token responde 401", async () => {
    const business = await createBusiness();

    const res = await request(app).post(`/api/businesses/${business.id}/contact`);
    expect(res.status).toBe(401);
  });

  test("POST /api/businesses/:id/contact responde 204 y suma un contacto real", async () => {
    const business = await createBusiness();

    const res = await request(app)
      .post(`/api/businesses/${business.id}/contact`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(204);

    const stats = await request(app).get("/api/businesses/me/stats").set("Authorization", `Bearer ${token}`);
    expect(stats.body).toEqual({ views: 0, contacts: 1 });
  });

  test("POST /api/businesses/:id/contact responde 400 si el dueño contacta su propio comercio", async () => {
    const business = await createBusiness();

    const res = await request(app)
      .post(`/api/businesses/${business.id}/contact`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  test("POST /api/businesses/me/subscription compra Premium mensual", async () => {
    const created = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(created.body.id);

    const res = await request(app)
      .post("/api/businesses/me/subscription")
      .set("Authorization", `Bearer ${token}`)
      .send({ period: "MONTHLY" });

    expect(res.status).toBe(201);
    expect(res.body.business.plan).toBe("PREMIUM");
    expect(res.body.business.planExpiresAt).toEqual(expect.any(String));
    expect(res.body.subscription).toMatchObject({ period: "MONTHLY", status: "APPROVED", provider: "fake" });
  });

  test("POST /api/businesses/me/subscription responde 400 con un período inválido", async () => {
    const created = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(created.body.id);

    const res = await request(app)
      .post("/api/businesses/me/subscription")
      .set("Authorization", `Bearer ${token}`)
      .send({ period: "WEEKLY" });

    expect(res.status).toBe(400);
  });

  test("POST /api/businesses/me/subscription responde 401 sin sesión", async () => {
    const res = await request(app).post("/api/businesses/me/subscription").send({ period: "MONTHLY" });

    expect(res.status).toBe(401);
  });

  test("POST /api/businesses/me/subscription responde 404 si el usuario no tiene comercio", async () => {
    const res = await request(app)
      .post("/api/businesses/me/subscription")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ period: "MONTHLY" });

    expect(res.status).toBe(404);
  });

  test("GET /api/plans devuelve los precios de Premium sin exigir sesión", async () => {
    const res = await request(app).get("/api/plans");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { plan: "PREMIUM", period: "MONTHLY", months: 1, priceUsd: 30 },
      { plan: "PREMIUM", period: "ANNUAL", months: 12, priceUsd: 300 },
    ]);
  });

  test("POST /api/businesses/:id/contact responde 404 si el comercio no existe", async () => {
    const res = await request(app)
      .post("/api/businesses/999999999/contact")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });
});
