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
});
