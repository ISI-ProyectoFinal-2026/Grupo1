import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as reportsService from "../../src/services/reports.service";

describe("reports.service", () => {
  let userId: number;
  let petId: number;
  const createdReportIds: number[] = [];

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `reports-service-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;

    const pet = await prisma.pet.create({
      data: {
        userId,
        name: "Firulais",
        breed: "Labrador",
        age: 3,
        color: "Marrón",
        description: "Mascota de prueba",
        photoUrls: ["https://cdn.example.com/foto.jpg"],
      },
    });
    petId = pet.id;
  });

  afterEach(async () => {
    while (createdReportIds.length > 0) {
      const id = createdReportIds.pop()!;
      await prisma.report.deleteMany({ where: { id } });
    }
  });

  afterAll(async () => {
    await prisma.pet.delete({ where: { id: petId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  const baseReportData = {
    reportType: "found" as const,
    title: "Perrito encontrado en Plaza de Mayo",
    description: "Cachorro mestizo, collar rojo",
    imageUrl: "https://cdn.example.com/hallazgo.jpg",
    location: { lat: -34.6037, lng: -58.3816 },
    locationAddress: "Plaza de Mayo, CABA",
  };

  test("create() crea un reporte de avistamiento sin petId (encontrado)", async () => {
    const report = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(report.id);

    expect(report.id).toBeDefined();
    expect(report.userId).toBe(userId);
    expect(report.petId).toBeNull();
    expect(report.reportType).toBe("found");
    expect(report.status).toBe("published");
    expect(report.publishedAt).not.toBeNull();
    expect(report.location?.lat).toBeCloseTo(-34.6037, 5);
    expect(report.location?.lng).toBeCloseTo(-58.3816, 5);
  });

  test("create() asocia un petId cuando se provee", async () => {
    const report = await reportsService.create({ userId, petId, ...baseReportData });
    createdReportIds.push(report.id);
    expect(report.petId).toBe(petId);
  });

  test("create() lanza AppError 400 si userId no existe", async () => {
    await expect(reportsService.create({ userId: 999999999, ...baseReportData })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test("create() lanza AppError 400 si petId no existe", async () => {
    await expect(reportsService.create({ userId, petId: 999999999, ...baseReportData })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test("list() incluye los reportes creados y expone location", async () => {
    const report = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(report.id);

    const reports = await reportsService.list();
    const found = reports.find((r) => r.id === report.id);
    expect(found).toBeDefined();
    expect(found?.location?.lat).toBeCloseTo(-34.6037, 5);
  });

  test("list() filtra por type y status", async () => {
    const report = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(report.id);

    const reports = await reportsService.list({ type: "found", status: "published" });
    expect(reports.some((r) => r.id === report.id)).toBe(true);

    const lostOnly = await reportsService.list({ type: "lost" });
    expect(lostOnly.some((r) => r.id === report.id)).toBe(false);
  });

  test("getById() devuelve el reporte correcto", async () => {
    const report = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(report.id);

    const found = await reportsService.getById(report.id);
    expect(found.id).toBe(report.id);
    expect(found.title).toBe(baseReportData.title);
  });

  test("getById() lanza AppError 404 si no existe", async () => {
    await expect(reportsService.getById(-1)).rejects.toMatchObject(
      new AppError(404, "Reporte no encontrado")
    );
  });

  test("update() modifica campos escalares", async () => {
    const report = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(report.id);

    const updated = await reportsService.update(report.id, { title: "Actualizado" });
    expect(updated.title).toBe("Actualizado");
  });

  test("update() actualiza la ubicación", async () => {
    const report = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(report.id);

    const updated = await reportsService.update(report.id, { location: { lat: 10, lng: 20 } });
    expect(updated.location?.lat).toBeCloseTo(10, 5);
    expect(updated.location?.lng).toBeCloseTo(20, 5);
  });

  test("update() lanza AppError 404 si no existe", async () => {
    await expect(reportsService.update(-1, { title: "x" })).rejects.toMatchObject({ statusCode: 404 });
  });

  test("remove() elimina el reporte", async () => {
    const report = await reportsService.create({ userId, ...baseReportData });
    await reportsService.remove(report.id);
    await expect(reportsService.getById(report.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  test("remove() lanza AppError 404 si no existe", async () => {
    await expect(reportsService.remove(-1)).rejects.toMatchObject({ statusCode: 404 });
  });

  test("create() con reportType found expone tag ENCONTRADO", async () => {
    const report = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(report.id);
    expect(report.tag.label).toBe("ENCONTRADO");
  });

  test("create() con reportType lost expone tag PERDIDO", async () => {
    const report = await reportsService.create({ userId, ...baseReportData, reportType: "lost" });
    createdReportIds.push(report.id);
    expect(report.tag.label).toBe("PERDIDO");
  });

  test("update() a status resolved expone tag RESUELTO sin importar el reportType", async () => {
    const report = await reportsService.create({ userId, ...baseReportData, reportType: "lost" });
    createdReportIds.push(report.id);

    const updated = await reportsService.update(report.id, { status: "resolved" });
    expect(updated.tag.label).toBe("RESUELTO");
  });

  test("los tags PERDIDO, ENCONTRADO y RESUELTO tienen colores diferenciados entre sí", async () => {
    const lost = await reportsService.create({ userId, ...baseReportData, reportType: "lost" });
    createdReportIds.push(lost.id);
    const found = await reportsService.create({ userId, ...baseReportData, reportType: "found" });
    createdReportIds.push(found.id);
    const resolved = await reportsService.update(found.id, { status: "resolved" });

    const colors = new Set([lost.tag.color, found.tag.color, resolved.tag.color]);
    expect(colors.size).toBe(3);
  });
});
