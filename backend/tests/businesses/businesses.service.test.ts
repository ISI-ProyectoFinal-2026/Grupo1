import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as businessesService from "../../src/services/businesses.service";

describe("businesses.service", () => {
  let userId: number;
  let otherUserId: number;
  const createdBusinessIds: number[] = [];

  const baseBusinessData = {
    name: "Veterinaria San Roque",
    cuit: "30712345678",
    address: "Av. Siempre Viva 123",
    phone: "1122334455",
    category: "VETERINARIA" as const,
  };

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `businesses-service-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;

    const otherUser = await prisma.user.create({
      data: { email: `businesses-service-test-other-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    otherUserId = otherUser.id;
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

  test("create() crea el comercio vinculado al usuario", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData });
    createdBusinessIds.push(business.id);

    expect(business.id).toBeDefined();
    expect(business.userId).toBe(userId);
    expect(business.name).toBe(baseBusinessData.name);
    expect(business.plan).toBe("FREE");
  });

  test("create() lanza AppError 409 si el usuario ya tiene un comercio registrado", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData });
    createdBusinessIds.push(business.id);

    await expect(
      businessesService.create({ userId, ...baseBusinessData, cuit: "30787654321" })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("create() lanza AppError 409 si el cuit ya está registrado", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData });
    createdBusinessIds.push(business.id);

    await expect(
      businessesService.create({ userId: otherUserId, ...baseBusinessData })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("create() lanza AppError 400 si el userId no corresponde a un usuario existente", async () => {
    await expect(
      businessesService.create({ userId: 999999999, ...baseBusinessData })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("getByUserId() devuelve el comercio del usuario", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData });
    createdBusinessIds.push(business.id);

    const found = await businessesService.getByUserId(userId);
    expect(found.id).toBe(business.id);
  });

  test("getByUserId() lanza AppError 404 si el usuario no tiene comercio registrado", async () => {
    await expect(businessesService.getByUserId(otherUserId)).rejects.toMatchObject(
      new AppError(404, "Comercio no encontrado")
    );
  });

  test("updateByUserId() actualiza los datos del comercio", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData });
    createdBusinessIds.push(business.id);

    const updated = await businessesService.updateByUserId(userId, { name: "Nuevo nombre" });
    expect(updated.name).toBe("Nuevo nombre");
  });

  test("updateByUserId() lanza AppError 404 si el usuario no tiene comercio registrado", async () => {
    await expect(businessesService.updateByUserId(otherUserId, { name: "x" })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("getStats() devuelve estadísticas básicas del comercio", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData });
    createdBusinessIds.push(business.id);

    const stats = await businessesService.getStats(userId);
    expect(stats).toEqual({ views: 0, contacts: 0 });
  });

  test("getStats() lanza AppError 404 si el usuario no tiene comercio registrado", async () => {
    await expect(businessesService.getStats(otherUserId)).rejects.toMatchObject({ statusCode: 404 });
  });
});
