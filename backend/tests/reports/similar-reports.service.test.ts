import { prisma } from "../../src/db/client";
import * as matchingService from "../../src/services/matching.service";
import { findSimilarReports } from "../../src/services/similar-reports.service";

// Punto aislado de los datos de otras suites (Puerto Argentino). 0.009 grados de latitud ~ 1 km.
const CENTER = { lat: -51.6977, lng: -57.8517 };
const DAY_MS = 24 * 60 * 60 * 1000;
const IMAGE_URL = "https://pub-test.r2.dev/pets/nuevo.jpg";

// vector unitario de 768 dimensiones: coseno con unit(1, 0) = x
function unit(x: number, y: number): number[] {
  const v = new Array(768).fill(0);
  v[0] = x;
  v[1] = y;
  return v;
}

describe("similar-reports.service findSimilarReports", () => {
  let viewerId: number;
  let otherId: number;
  const reportIds: number[] = [];
  let embedSpy: jest.SpyInstance;

  async function createReport(
    title: string,
    offsetLat: number,
    opts: {
      type?: "lost" | "found";
      status?: "published" | "pending" | "rejected" | "resolved";
      createdAt?: Date;
      userId?: number;
      embedding?: number[];
    } = {}
  ) {
    const report = await prisma.report.create({
      data: {
        userId: opts.userId ?? otherId,
        reportType: opts.type ?? "found",
        status: opts.status ?? "published",
        title,
        imageUrl: "https://pub-test.r2.dev/pets/existente.jpg",
        createdAt: opts.createdAt,
      },
    });
    reportIds.push(report.id);
    await prisma.$executeRaw`
      UPDATE reports
      SET location = ST_SetSRID(ST_MakePoint(${CENTER.lng}, ${CENTER.lat + offsetLat}), 4326)
      WHERE id = ${report.id}
    `;
    if (opts.embedding) {
      const literal = `[${opts.embedding.join(",")}]`;
      await prisma.$executeRaw`
        INSERT INTO report_embeddings (report_id, embedding) VALUES (${report.id}, ${literal}::vector)
      `;
    }
    return report.id;
  }

  const search = (overrides: { reportType?: "lost" | "found"; imageUrl?: string } = {}) =>
    findSimilarReports({ reportType: "found", location: CENTER, ...overrides }, viewerId);

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    viewerId = (await prisma.user.create({ data: { email: `similar-viewer-${suffix}@example.com`, passwordHash: "x" } })).id;
    otherId = (await prisma.user.create({ data: { email: `similar-other-${suffix}@example.com`, passwordHash: "x" } })).id;
  });

  beforeEach(() => {
    embedSpy = jest.spyOn(matchingService, "embedImage").mockResolvedValue(null);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    const ids = reportIds.splice(0);
    await prisma.reportEmbedding.deleteMany({ where: { reportId: { in: ids } } });
    await prisma.report.deleteMany({ where: { id: { in: ids } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [viewerId, otherId] } } });
    await prisma.$disconnect();
  });

  test("solo sugiere reportes del mismo tipo", async () => {
    const found = await createReport("Encontrado", 0.001, { type: "found" });
    const lost = await createReport("Perdido", 0.001, { type: "lost" });

    const ids = (await search({ reportType: "found" })).map((r) => r.id);

    expect(ids).toContain(found);
    expect(ids).not.toContain(lost);
  });

  test("respeta el radio de 2 km", async () => {
    const cerca = await createReport("A 1.8 km", 0.0162);
    const lejos = await createReport("A 2.5 km", 0.0225);

    const ids = (await search()).map((r) => r.id);

    expect(ids).toContain(cerca);
    expect(ids).not.toContain(lejos);
  });

  test("respeta la ventana de 30 días", async () => {
    const reciente = await createReport("Hace 29 días", 0.001, { createdAt: new Date(Date.now() - 29 * DAY_MS) });
    const viejo = await createReport("Hace 31 días", 0.001, { createdAt: new Date(Date.now() - 31 * DAY_MS) });

    const ids = (await search()).map((r) => r.id);

    expect(ids).toContain(reciente);
    expect(ids).not.toContain(viejo);
  });

  test("incluye publicados y resueltos, nunca pendientes ni rechazados", async () => {
    const publicado = await createReport("Publicado", 0.001);
    const resuelto = await createReport("Resuelto", 0.002, { status: "resolved" });
    const pendiente = await createReport("Pendiente", 0.001, { status: "pending" });
    const rechazado = await createReport("Rechazado", 0.001, { status: "rejected" });

    const result = await search();
    const ids = result.map((r) => r.id);

    expect(ids).toEqual(expect.arrayContaining([publicado, resuelto]));
    expect(ids).not.toContain(pendiente);
    expect(ids).not.toContain(rechazado);
    expect(result.find((r) => r.id === resuelto)?.status).toBe("resolved");
  });

  test("marca los reportes propios del usuario", async () => {
    const propio = await createReport("Propio", 0.001, { userId: viewerId });
    const ajeno = await createReport("Ajeno", 0.002);

    const result = await search();

    expect(result.find((r) => r.id === propio)?.isOwn).toBe(true);
    expect(result.find((r) => r.id === ajeno)?.isOwn).toBe(false);
  });

  test("devuelve como máximo 3 sugerencias", async () => {
    for (let i = 1; i <= 5; i++) await createReport(`Reporte ${i}`, 0.001 * i);

    expect(await search()).toHaveLength(3);
  });

  test("sin foto ordena por cercanía, con similitud null y sin llamar a la IA", async () => {
    const medio = await createReport("A 900 m", 0.0081, { embedding: unit(1, 0) });
    const cerca = await createReport("A 100 m", 0.0009);
    const lejos = await createReport("A 1.5 km", 0.0135);

    const result = await search();

    expect(result.map((r) => r.id)).toEqual([cerca, medio, lejos]);
    expect(result.every((r) => r.similarity === null)).toBe(true);
    expect(result[0].distanceMeters).toBeGreaterThan(50);
    expect(result[0].distanceMeters).toBeLessThan(150);
    expect(embedSpy).not.toHaveBeenCalled();
  });

  test("con foto ordena por similitud de imagen y deja al final los candidatos sin embedding", async () => {
    embedSpy.mockResolvedValue(unit(1, 0));
    const parecido = await createReport("Parecido", 0.0135, { embedding: unit(1, 0) });
    const medio = await createReport("Medio", 0.0081, { embedding: unit(0.6, 0.8) });
    const sinEmbedding = await createReport("Sin embedding", 0.0009);

    const result = await search({ imageUrl: IMAGE_URL });

    expect(embedSpy).toHaveBeenCalledWith(IMAGE_URL);
    expect(result.map((r) => r.id)).toEqual([parecido, medio, sinEmbedding]);
    expect(result[0].similarity).toBeCloseTo(1, 5);
    expect(result[1].similarity).toBeCloseTo(0.6, 5);
    expect(result[2].similarity).toBeNull();
  });

  test("si la IA no responde cae al orden por cercanía", async () => {
    embedSpy.mockResolvedValue(null);
    const lejos = await createReport("Lejos", 0.0135, { embedding: unit(1, 0) });
    const cerca = await createReport("Cerca", 0.0009, { embedding: unit(0, 1) });

    const result = await search({ imageUrl: IMAGE_URL });

    expect(result.map((r) => r.id)).toEqual([cerca, lejos]);
    expect(result.every((r) => r.similarity === null)).toBe(true);
  });

  test("el DTO no expone datos del autor", async () => {
    await createReport("Con autor", 0.001);

    const [item] = await search();

    expect(Object.keys(item).sort()).toEqual(
      ["distanceMeters", "id", "imageUrl", "isOwn", "reportType", "similarity", "status", "title"].sort()
    );
  });
});
