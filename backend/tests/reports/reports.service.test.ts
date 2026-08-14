import { prisma } from "../../src/db/client";
import { AppError } from "../../src/errors/app-error";
import * as reportsService from "../../src/services/reports.service";
import * as matchingService from "../../src/services/matching.service";

describe("reports.service", () => {
  let userId: number;
  let petId: number;
  let petIdPoodle: number;
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

    const poodle = await prisma.pet.create({
      data: {
        userId,
        name: "Toby",
        breed: "Poodle",
        age: 2,
        color: "Blanco",
        description: "Mascota de prueba 2",
        photoUrls: [],
      },
    });
    petIdPoodle = poodle.id;
  });

  afterEach(async () => {
    while (createdReportIds.length > 0) {
      const id = createdReportIds.pop()!;
      await prisma.report.deleteMany({ where: { id } });
    }
  });

  afterAll(async () => {
    await prisma.pet.delete({ where: { id: petId } });
    await prisma.pet.delete({ where: { id: petIdPoodle } });
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

  test("create() dispara triggerEmbeddingGeneration cuando el reporte tiene imageUrl", async () => {
    const spy = jest.spyOn(matchingService, "triggerEmbeddingGeneration").mockImplementation(() => {});

    const report = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(report.id);

    expect(spy).toHaveBeenCalledWith(report.id, baseReportData.imageUrl);
    spy.mockRestore();
  });

  test("create() sigue devolviendo el reporte creado aunque triggerEmbeddingGeneration falle", async () => {
    const spy = jest.spyOn(matchingService, "triggerEmbeddingGeneration").mockImplementation(() => {
      throw new Error("ai service down");
    });

    const report = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(report.id);

    expect(report.id).toBeDefined();
    expect(report.status).toBe("published");
    spy.mockRestore();
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

  test("list() sin filtro de status solo devuelve reportes activos (published)", async () => {
    const published = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(published.id);
    const resolved = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(resolved.id);
    await reportsService.update(resolved.id, { status: "resolved" });

    const activeFeed = await reportsService.list();
    expect(activeFeed.some((r) => r.id === published.id)).toBe(true);
    expect(activeFeed.some((r) => r.id === resolved.id)).toBe(false);

    const resolvedOnly = await reportsService.list({ status: "resolved" });
    expect(resolvedOnly.some((r) => r.id === resolved.id)).toBe(true);
  });

  test("list() filtra por raza a través de la mascota asociada", async () => {
    const labradorReport = await reportsService.create({ userId, petId, ...baseReportData });
    createdReportIds.push(labradorReport.id);
    const poodleReport = await reportsService.create({ userId, petId: petIdPoodle, ...baseReportData });
    createdReportIds.push(poodleReport.id);

    const reports = await reportsService.list({ breed: "Labrador" });
    expect(reports.some((r) => r.id === labradorReport.id)).toBe(true);
    expect(reports.some((r) => r.id === poodleReport.id)).toBe(false);
  });

  test("list() filtra por raza sin distinguir mayúsculas/minúsculas", async () => {
    const labradorReport = await reportsService.create({ userId, petId, ...baseReportData });
    createdReportIds.push(labradorReport.id);

    const reports = await reportsService.list({ breed: "labrador" });
    expect(reports.some((r) => r.id === labradorReport.id)).toBe(true);
  });

  test("list() filtra por zona con match parcial de locationAddress", async () => {
    const plazaDeMayo = await reportsService.create({
      userId,
      ...baseReportData,
      locationAddress: "Plaza de Mayo, CABA",
    });
    createdReportIds.push(plazaDeMayo.id);
    const parqueRivadavia = await reportsService.create({
      userId,
      ...baseReportData,
      locationAddress: "Parque Rivadavia, CABA",
    });
    createdReportIds.push(parqueRivadavia.id);

    const reports = await reportsService.list({ zone: "Plaza de Mayo" });
    expect(reports.some((r) => r.id === plazaDeMayo.id)).toBe(true);
    expect(reports.some((r) => r.id === parqueRivadavia.id)).toBe(false);
  });

  test("list() filtra por rango de fechas (dateFrom/dateTo)", async () => {
    const recent = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(recent.id);
    const old = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(old.id);
    await prisma.$executeRaw`UPDATE reports SET created_at = '2020-01-01T00:00:00Z' WHERE id = ${old.id}`;

    const onlyRecent = await reportsService.list({ dateFrom: new Date(Date.now() - 60_000) });
    expect(onlyRecent.some((r) => r.id === recent.id)).toBe(true);
    expect(onlyRecent.some((r) => r.id === old.id)).toBe(false);

    const onlyOld = await reportsService.list({ dateTo: new Date("2020-06-01") });
    expect(onlyOld.some((r) => r.id === old.id)).toBe(true);
    expect(onlyOld.some((r) => r.id === recent.id)).toBe(false);
  });

  test("list() ordena por fecha, DESC por defecto y ASC cuando se pide", async () => {
    const first = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(first.id);
    await prisma.$executeRaw`UPDATE reports SET created_at = '2021-01-01T00:00:00Z' WHERE id = ${first.id}`;
    const second = await reportsService.create({ userId, ...baseReportData });
    createdReportIds.push(second.id);
    await prisma.$executeRaw`UPDATE reports SET created_at = '2022-01-01T00:00:00Z' WHERE id = ${second.id}`;

    const desc = await reportsService.list({ order: "desc" });
    const descIds = desc.map((r) => r.id).filter((id) => id === first.id || id === second.id);
    expect(descIds).toEqual([second.id, first.id]);

    const asc = await reportsService.list({ order: "asc" });
    const ascIds = asc.map((r) => r.id).filter((id) => id === first.id || id === second.id);
    expect(ascIds).toEqual([first.id, second.id]);
  });
});
