import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/db/client";
import { createTestUser } from "../helpers/users";
import { createPublishedReport, mockImageModeration, TEST_IMAGE_URL } from "../helpers/reports";

// mascota vinculada a un reporte: solo la propia (#310)
describe("petId de un reporte", () => {
  let ownerId: number;
  let ownerToken: string;
  let otherId: number;
  let ownPetId: number;
  let otherPetId: number;

  const baseReport = {
    reportType: "lost",
    title: "Perro perdido mascota-310",
    location: { lat: -34.6, lng: -58.38 },
  };

  beforeAll(async () => {
    const owner = await createTestUser({ prefix: "pet-ownership-owner" });
    ownerId = owner.user.id;
    ownerToken = owner.token;
    otherId = (await createTestUser({ prefix: "pet-ownership-other" })).user.id;
    ownPetId = (await prisma.pet.create({ data: { userId: ownerId, name: "Propia", photoUrls: [] } })).id;
    otherPetId = (await prisma.pet.create({ data: { userId: otherId, name: "Ajena", photoUrls: [] } })).id;
  });

  beforeEach(() => {
    mockImageModeration();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.report.deleteMany({ where: { userId: ownerId } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await prisma.$disconnect();
  });

  function post(petId: number) {
    return request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ ...baseReport, imageUrl: TEST_IMAGE_URL, petId });
  }

  test("POST con la mascota de otro usuario responde 403 y no crea el reporte", async () => {
    const res = await post(otherPetId);

    expect(res.status).toBe(403);
    expect(await prisma.report.count({ where: { userId: ownerId } })).toBe(0);
  });

  test("POST con la mascota propia responde 201", async () => {
    const res = await post(ownPetId);

    expect(res.status).toBe(201);
    expect(res.body.petId).toBe(ownPetId);
  });

  test("PUT con la mascota de otro usuario responde 403 y no modifica el reporte", async () => {
    const report = await createPublishedReport(ownerToken, baseReport);

    const res = await request(app)
      .put(`/api/reports/${report.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Titulo cambiado", petId: otherPetId });

    expect(res.status).toBe(403);
    const stored = await prisma.report.findUnique({ where: { id: report.id } });
    expect(stored).toMatchObject({ petId: null, title: baseReport.title });
  });

  test("PUT con la mascota propia responde 200", async () => {
    const report = await createPublishedReport(ownerToken, baseReport);

    const res = await request(app)
      .put(`/api/reports/${report.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ petId: ownPetId });

    expect(res.status).toBe(200);
    expect(res.body.petId).toBe(ownPetId);
  });
});
