import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as businessesService from "../../src/services/businesses.service";

describe("businesses.service", () => {
  let userId: number;
  let otherUserId: number;
  const createdBusinessIds: number[] = [];

  const baseBusinessData = {
    name: "Veterinaria San Roque",
    address: "Av. Siempre Viva 123",
    phone: "1122334455",
    category: "VETERINARIA" as const,
  };

  function uniqueCuit(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

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
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    expect(business.id).toBeDefined();
    expect(business.userId).toBe(userId);
    expect(business.name).toBe(baseBusinessData.name);
    expect(business.plan).toBe("FREE");
  });

  test("create() lanza AppError 409 si el usuario ya tiene un comercio registrado", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    await expect(
      businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("create() lanza AppError 409 si el cuit ya está registrado", async () => {
    const cuit = uniqueCuit();
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit });
    createdBusinessIds.push(business.id);

    await expect(
      businessesService.create({ userId: otherUserId, ...baseBusinessData, cuit })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("create() lanza AppError 400 si el userId no corresponde a un usuario existente", async () => {
    await expect(
      businessesService.create({ userId: 999999999, ...baseBusinessData, cuit: uniqueCuit() })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("getByUserId() devuelve el comercio del usuario", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
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
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    const updated = await businessesService.updateByUserId(userId, { name: "Nuevo nombre" });
    expect(updated.name).toBe("Nuevo nombre");
  });

  test("create() con plan PREMIUM persiste el comercio como premium", async () => {
    const business = await businessesService.create({
      userId,
      ...baseBusinessData,
      cuit: uniqueCuit(),
      plan: "PREMIUM",
    });
    createdBusinessIds.push(business.id);

    expect(business.plan).toBe("PREMIUM");
  });

  test("updateByUserId() con plan PREMIUM cambia un comercio FREE a premium", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);
    expect(business.plan).toBe("FREE");

    const updated = await businessesService.updateByUserId(userId, { plan: "PREMIUM" });
    expect(updated.plan).toBe("PREMIUM");
  });

  test("updateByUserId() lanza AppError 404 si el usuario no tiene comercio registrado", async () => {
    await expect(businessesService.updateByUserId(otherUserId, { name: "x" })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("getStats() devuelve estadísticas básicas del comercio", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    const stats = await businessesService.getStats(userId);
    expect(stats).toEqual({ views: 0, contacts: 0 });
  });

  test("getStats() lanza AppError 404 si el usuario no tiene comercio registrado", async () => {
    await expect(businessesService.getStats(otherUserId)).rejects.toMatchObject({ statusCode: 404 });
  });

  test("listPublic() no expone cuit ni userId", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    const list = await businessesService.listPublic({});
    const found = list.find((item) => item.id === business.id);

    expect(found).toBeDefined();
    expect(found).not.toHaveProperty("cuit");
    expect(found).not.toHaveProperty("userId");
    expect(found!.name).toBe(baseBusinessData.name);
  });

  test("listPublic() filtra por categoría", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    const sameCategory = await businessesService.listPublic({ category: "VETERINARIA" });
    const otherCategory = await businessesService.listPublic({ category: "PET_SHOP" });

    expect(sameCategory.some((item) => item.id === business.id)).toBe(true);
    expect(otherCategory.some((item) => item.id === business.id)).toBe(false);
  });

  test("getPublicById() no expone cuit ni userId", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    const publicBusiness = await businessesService.getPublicById(business.id);

    expect(publicBusiness.id).toBe(business.id);
    expect(publicBusiness).not.toHaveProperty("cuit");
    expect(publicBusiness).not.toHaveProperty("userId");
  });

  test("getPublicById() lanza AppError 404 si el comercio no existe", async () => {
    await expect(businessesService.getPublicById(999999999)).rejects.toMatchObject({ statusCode: 404 });
  });

  test("recordView() persiste el evento y getStats() lo refleja", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    await businessesService.recordView(business.id, otherUserId);

    const stats = await businessesService.getStats(userId);
    expect(stats).toEqual({ views: 1, contacts: 0 });
  });

  test("recordView() no registra las visitas del propio dueño", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    await businessesService.recordView(business.id, userId);

    const stats = await businessesService.getStats(userId);
    expect(stats.views).toBe(0);
  });

  test("recordView() registra visitas anónimas con userId null", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    await businessesService.recordView(business.id);

    const events = await prisma.businessEvent.findMany({ where: { businessId: business.id } });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("VIEW");
    expect(events[0].userId).toBeNull();
  });

  test("recordView() lanza AppError 404 si el comercio no existe", async () => {
    await expect(businessesService.recordView(999999999, otherUserId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("recordContact() persiste el evento y getStats() lo refleja", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    await businessesService.recordContact(business.id, otherUserId);

    const stats = await businessesService.getStats(userId);
    expect(stats).toEqual({ views: 0, contacts: 1 });
  });

  test("recordContact() lanza AppError 400 si el dueño contacta su propio comercio", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    await expect(businessesService.recordContact(business.id, userId)).rejects.toMatchObject({
      statusCode: 400,
    });

    const stats = await businessesService.getStats(userId);
    expect(stats.contacts).toBe(0);
  });

  test("recordContact() lanza AppError 404 si el comercio no existe", async () => {
    await expect(businessesService.recordContact(999999999, otherUserId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("getStats() agrega los conteos reales de vistas y contactos", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    createdBusinessIds.push(business.id);

    await businessesService.recordView(business.id, otherUserId);
    await businessesService.recordView(business.id);
    await businessesService.recordContact(business.id, otherUserId);

    const stats = await businessesService.getStats(userId);
    expect(stats).toEqual({ views: 2, contacts: 1 });
  });

  test("borrar el comercio elimina en cascada sus eventos", async () => {
    const business = await businessesService.create({ userId, ...baseBusinessData, cuit: uniqueCuit() });
    await businessesService.recordView(business.id, otherUserId);

    await prisma.business.delete({ where: { id: business.id } });

    const events = await prisma.businessEvent.findMany({ where: { businessId: business.id } });
    expect(events).toHaveLength(0);
  });
});
