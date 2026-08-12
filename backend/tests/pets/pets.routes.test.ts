import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";

describe("GET/POST/PUT/DELETE /api/pets", () => {
  let userId: number;
  const createdPetIds: number[] = [];
  const basePetData = {
    breed: "Labrador",
    age: 3,
    color: "Marrón",
    description: "Mascota de prueba",
    photoUrls: ["https://cdn.example.com/foto1.jpg"],
  };

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `pets-routes-test-${Date.now()}@example.com`,
        passwordHash: "test-hash",
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    while (createdPetIds.length > 0) {
      const id = createdPetIds.pop()!;
      await prisma.pet.deleteMany({ where: { id } });
    }
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test("POST /api/pets crea una mascota y responde 201", async () => {
    const res = await request(app)
      .post("/api/pets")
      .send({ userId, name: "Rocky", ...basePetData });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Rocky");
    expect(res.body.color).toBe("Marrón");
    expect(res.body.photoUrls).toEqual(["https://cdn.example.com/foto1.jpg"]);
    createdPetIds.push(res.body.id);
  });

  test("POST /api/pets responde 400 si el body es inválido", async () => {
    const res = await request(app).post("/api/pets").send({ name: "Sin userId" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("POST /api/pets responde 400 si falta un campo requerido (color)", async () => {
    const { color, ...withoutColor } = basePetData;
    const res = await request(app)
      .post("/api/pets")
      .send({ userId, name: "Sin color", ...withoutColor });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("POST /api/pets responde 400 si no se incluye ninguna foto", async () => {
    const res = await request(app)
      .post("/api/pets")
      .send({ userId, name: "Sin fotos", ...basePetData, photoUrls: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("POST /api/pets responde 400 si el JSON del body está mal formado", async () => {
    const res = await request(app)
      .post("/api/pets")
      .set("Content-Type", "application/json")
      .send('{"userId":1,"name":"Malformado"');

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("GET /api/pets responde 200 con un array", async () => {
    const created = await request(app)
      .post("/api/pets")
      .send({ userId, name: "Lista", ...basePetData });
    createdPetIds.push(created.body.id);

    const res = await request(app).get("/api/pets");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((p: { id: number }) => p.id === created.body.id)).toBe(true);
  });

  test("GET /api/pets/:id responde 200 con la mascota", async () => {
    const created = await request(app)
      .post("/api/pets")
      .send({ userId, name: "Buscada", ...basePetData });
    createdPetIds.push(created.body.id);

    const res = await request(app).get(`/api/pets/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  test("GET /api/pets/:id responde 404 si no existe", async () => {
    const res = await request(app).get("/api/pets/999999999");
    expect(res.status).toBe(404);
  });

  test("GET /api/pets/:id responde 400 si el id no es numérico", async () => {
    const res = await request(app).get("/api/pets/abc");
    expect(res.status).toBe(400);
  });

  test("PUT /api/pets/:id actualiza la mascota", async () => {
    const created = await request(app)
      .post("/api/pets")
      .send({ userId, name: "Original", ...basePetData });
    createdPetIds.push(created.body.id);

    const res = await request(app).put(`/api/pets/${created.body.id}`).send({ name: "Actualizada" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Actualizada");
  });

  test("PUT /api/pets/:id responde 404 si no existe", async () => {
    const res = await request(app).put("/api/pets/999999999").send({ name: "x" });
    expect(res.status).toBe(404);
  });

  test("DELETE /api/pets/:id elimina la mascota y responde 204", async () => {
    const created = await request(app)
      .post("/api/pets")
      .send({ userId, name: "A borrar", ...basePetData });

    const res = await request(app).delete(`/api/pets/${created.body.id}`);

    expect(res.status).toBe(204);

    const getRes = await request(app).get(`/api/pets/${created.body.id}`);
    expect(getRes.status).toBe(404);
  });

  test("DELETE /api/pets/:id responde 404 si no existe", async () => {
    const res = await request(app).delete("/api/pets/999999999");
    expect(res.status).toBe(404);
  });
});
