import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

describe("GET/POST/PUT/DELETE /api/pets", () => {
  let userId: number;
  let token: string;
  const createdPetIds: number[] = [];
  const basePetData = {
    breed: "Labrador",
    age: 3,
    color: "Marrón",
    description: "Mascota de prueba",
    photoUrls: ["https://pub-test.r2.dev/pets/foto1.jpg"],
  };

  let otherUserId: number;
  let otherToken: string;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    // las fotos tienen que venir del bucket R2 (#229)
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    const user = await prisma.user.create({
      data: {
        email: `pets-routes-test-${Date.now()}@example.com`,
        passwordHash: "test-hash",
      },
    });
    userId = user.id;
    token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    const otherUser = await prisma.user.create({
      data: {
        email: `pets-routes-test-other-${Date.now()}@example.com`,
        passwordHash: "test-hash",
      },
    });
    otherUserId = otherUser.id;
    otherToken = jwt.sign({ sub: otherUser.id, email: otherUser.email }, process.env.JWT_SECRET!, { expiresIn: "1h" });
  });

  afterEach(async () => {
    while (createdPetIds.length > 0) {
      const id = createdPetIds.pop()!;
      await prisma.pet.deleteMany({ where: { id } });
    }
  });

  afterAll(async () => {
    process.env = { ...originalEnv };
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: otherUserId } });
    await prisma.$disconnect();
  });

  test("POST /api/pets crea una mascota y responde 201", async () => {
    const res = await request(app)
      .post("/api/pets").set("Authorization", `Bearer ${token}`)
      .send({ userId, name: "Rocky", ...basePetData });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Rocky");
    expect(res.body.color).toBe("Marrón");
    expect(res.body.photoUrls).toEqual(["https://pub-test.r2.dev/pets/foto1.jpg"]);
    createdPetIds.push(res.body.id);
  });

  test("POST /api/pets responde 400 si el body es inválido", async () => {
    const res = await request(app).post("/api/pets").set("Authorization", `Bearer ${token}`).send({ name: "Sin userId" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("POST /api/pets responde 400 si falta un campo requerido (color)", async () => {
    const { color, ...withoutColor } = basePetData;
    const res = await request(app)
      .post("/api/pets").set("Authorization", `Bearer ${token}`)
      .send({ userId, name: "Sin color", ...withoutColor });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("POST /api/pets responde 400 si no se incluye ninguna foto", async () => {
    const res = await request(app)
      .post("/api/pets").set("Authorization", `Bearer ${token}`)
      .send({ userId, name: "Sin fotos", ...basePetData, photoUrls: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  // #229: fotos solo del bucket R2 del proyecto
  test.each(["https://evil.com/foto.jpg", "https://pub-test.r2.dev\\@evil.com/foto.jpg"])(
    "POST /api/pets responde 400 y no crea nada si una foto está fuera del bucket: %s",
    async (externa) => {
      const res = await request(app)
        .post("/api/pets").set("Authorization", `Bearer ${token}`)
        .send({ name: "Foto externa", ...basePetData, photoUrls: ["https://pub-test.r2.dev/pets/foto1.jpg", externa] });

      expect(res.status).toBe(400);
      expect(await prisma.pet.findFirst({ where: { userId, name: "Foto externa" } })).toBeNull();
    }
  );

  test("PUT /api/pets/:id responde 400 y no cambia las fotos si una está fuera del bucket", async () => {
    const created = await prisma.pet.create({
      data: { userId, name: "Con fotos", ...basePetData, photoUrls: ["https://pub-test.r2.dev/pets/foto1.jpg"] },
    });
    createdPetIds.push(created.id);

    const res = await request(app)
      .put(`/api/pets/${created.id}`).set("Authorization", `Bearer ${token}`)
      .send({ photoUrls: ["https://evil.com/foto.jpg"] });

    expect(res.status).toBe(400);
    const stored = await prisma.pet.findUnique({ where: { id: created.id } });
    expect(stored?.photoUrls).toEqual(["https://pub-test.r2.dev/pets/foto1.jpg"]);
  });

  test("POST /api/pets responde 400 si el JSON del body está mal formado", async () => {
    const res = await request(app)
      .post("/api/pets").set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send('{"userId":1,"name":"Malformado"');

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("GET /api/pets responde 200 solo con las mascotas del usuario autenticado", async () => {
    const own = await request(app)
      .post("/api/pets").set("Authorization", `Bearer ${token}`)
      .send({ name: "Propia", ...basePetData });
    const foreign = await request(app)
      .post("/api/pets").set("Authorization", `Bearer ${otherToken}`)
      .send({ name: "Ajena", ...basePetData });
    createdPetIds.push(own.body.id, foreign.body.id);

    const res = await request(app).get("/api/pets").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((p: { id: number }) => p.id === own.body.id)).toBe(true);
    expect(res.body.some((p: { id: number }) => p.id === foreign.body.id)).toBe(false);
    expect(res.body.every((p: { userId: number }) => p.userId === userId)).toBe(true);
  });

  test("GET /api/pets/:id responde 200 con la mascota", async () => {
    const created = await request(app)
      .post("/api/pets").set("Authorization", `Bearer ${token}`)
      .send({ userId, name: "Buscada", ...basePetData });
    createdPetIds.push(created.body.id);

    const res = await request(app).get(`/api/pets/${created.body.id}`).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  test("GET /api/pets/:id responde 404 si no existe", async () => {
    const res = await request(app).get("/api/pets/999999999").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("GET /api/pets/:id responde 400 si el id no es numérico", async () => {
    const res = await request(app).get("/api/pets/abc").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test("PUT /api/pets/:id actualiza la mascota", async () => {
    const created = await request(app)
      .post("/api/pets").set("Authorization", `Bearer ${token}`)
      .send({ userId, name: "Original", ...basePetData });
    createdPetIds.push(created.body.id);

    const res = await request(app).put(`/api/pets/${created.body.id}`).set("Authorization", `Bearer ${token}`).send({ name: "Actualizada" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Actualizada");
  });

  test("PUT /api/pets/:id responde 404 si no existe", async () => {
    const res = await request(app).put("/api/pets/999999999").set("Authorization", `Bearer ${token}`).send({ name: "x" });
    expect(res.status).toBe(404);
  });

  test("DELETE /api/pets/:id elimina la mascota y responde 204", async () => {
    const created = await request(app)
      .post("/api/pets").set("Authorization", `Bearer ${token}`)
      .send({ userId, name: "A borrar", ...basePetData });

    const res = await request(app).delete(`/api/pets/${created.body.id}`).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);

    const getRes = await request(app).get(`/api/pets/${created.body.id}`).set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  test("DELETE /api/pets/:id responde 404 si no existe", async () => {
    const res = await request(app).delete("/api/pets/999999999").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("PUT /api/pets/:id responde 403 si el usuario no es el dueño", async () => {
    const created = await request(app)
      .post("/api/pets").set("Authorization", `Bearer ${token}`)
      .send({ name: "Ajena", ...basePetData });
    createdPetIds.push(created.body.id);

    const res = await request(app)
      .put(`/api/pets/${created.body.id}`).set("Authorization", `Bearer ${otherToken}`)
      .send({ name: "Robada" });
    expect(res.status).toBe(403);
  });

  test("DELETE /api/pets/:id responde 403 si el usuario no es el dueño", async () => {
    const created = await request(app)
      .post("/api/pets").set("Authorization", `Bearer ${token}`)
      .send({ name: "Ajena", ...basePetData });
    createdPetIds.push(created.body.id);

    const res = await request(app).delete(`/api/pets/${created.body.id}`).set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  describe("autenticación en /api/pets", () => {
    test("POST /api/pets sin token responde 401", async () => {
      const res = await request(app).post("/api/pets").send({ userId, name: "Sin token", ...basePetData });
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test("POST /api/pets con token expirado responde 401", async () => {
      const expiredToken = jwt.sign({ sub: userId, email: "expired@example.com" }, process.env.JWT_SECRET!, {
        expiresIn: -1,
      });

      const res = await request(app)
        .post("/api/pets")
        .set("Authorization", `Bearer ${expiredToken}`)
        .send({ userId, name: "Token vencido", ...basePetData });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test("POST /api/pets con token válido responde 201", async () => {
      const res = await request(app)
        .post("/api/pets")
        .set("Authorization", `Bearer ${token}`)
        .send({ userId, name: "Con token", ...basePetData });

      expect(res.status).toBe(201);
      createdPetIds.push(res.body.id);
    });

    test("GET /api/pets sin token responde 401", async () => {
      const res = await request(app).get("/api/pets");
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test("GET /api/pets/:id sin token responde 401", async () => {
      const created = await request(app)
        .post("/api/pets").set("Authorization", `Bearer ${token}`)
        .send({ name: "Privada", ...basePetData });
      createdPetIds.push(created.body.id);

      const res = await request(app).get(`/api/pets/${created.body.id}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    test("GET /api/pets/:id con token de otro usuario responde 403", async () => {
      const created = await request(app)
        .post("/api/pets").set("Authorization", `Bearer ${token}`)
        .send({ name: "Ajena", ...basePetData });
      createdPetIds.push(created.body.id);

      const res = await request(app).get(`/api/pets/${created.body.id}`).set("Authorization", `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
      expect(res.body.microchipId).toBeUndefined();
    });

    test("GET /api/pets/:id con token del dueño responde 200 con la mascota", async () => {
      const created = await request(app)
        .post("/api/pets").set("Authorization", `Bearer ${token}`)
        .send({ name: "Propia", ...basePetData });
      createdPetIds.push(created.body.id);

      const res = await request(app).get(`/api/pets/${created.body.id}`).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.userId).toBe(userId);
    });
  });
});
