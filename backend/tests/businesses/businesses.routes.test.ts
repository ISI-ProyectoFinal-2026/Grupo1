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
  };

  function uniqueCuit(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `businesses-routes-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;
    token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

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

  test("POST /api/businesses/:id/contact responde 404 si el comercio no existe", async () => {
    const res = await request(app)
      .post("/api/businesses/999999999/contact")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });
});
