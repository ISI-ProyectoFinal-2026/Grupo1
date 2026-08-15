import { triggerEmbeddingGeneration, listMatches } from "../../src/services/matching.service";
import { prisma } from "../../src/db/client";

describe("matching.service", () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;
  let updateSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.fn();
    // @ts-expect-error -- test double, no necesita implementar el tipo completo de fetch
    global.fetch = fetchMock;
    updateSpy = jest.spyOn(prisma.report, "update").mockResolvedValue({} as never);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test("no llama a fetch si AI_SERVICE_URL no está configurada", () => {
    delete process.env.AI_SERVICE_URL;

    triggerEmbeddingGeneration(1, "https://cdn.example.com/foto.jpg");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("hace POST a AI_SERVICE_URL/reports/:id/embedding con el body correcto", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 201 });

    triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/reports/42/embedding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: "https://cdn.example.com/foto.jpg" }),
    });

    // deja que la resolución interna del fetch procese antes de que termine el test
    await new Promise((resolve) => setImmediate(resolve));
  });

  test("fetch resuelve con status 201 (mascota detectada) -> marca el reporte como published", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 201 });

    triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg");
    await new Promise((resolve) => setImmediate(resolve));

    expect(updateSpy).toHaveBeenCalledWith({ where: { id: 42 }, data: { status: "published" } });
  });

  test("fetch resuelve con status 422 (sin mascota detectada) -> marca el reporte como rejected", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 422 });

    triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg");
    await new Promise((resolve) => setImmediate(resolve));

    expect(updateSpy).toHaveBeenCalledWith({ where: { id: 42 }, data: { status: "rejected" } });
  });

  test("fetch resuelve con un status distinto de 201/422 -> no actualiza el status del reporte", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 500 });

    expect(() => triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg")).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));

    expect(updateSpy).not.toHaveBeenCalled();
  });

  test("un fetch que rechaza no lanza ni genera un unhandled rejection, y no actualiza el status", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockRejectedValue(new Error("network down"));

    expect(() => triggerEmbeddingGeneration(1, "https://cdn.example.com/foto.jpg")).not.toThrow();

    // deja que el .catch() interno procese el rechazo antes de que termine el test
    await new Promise((resolve) => setImmediate(resolve));
    expect(updateSpy).not.toHaveBeenCalled();
  });
});

describe("matching.service listMatches", () => {
  let userId: number;
  let lostReportId: number;
  let foundReportId: number;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `matching-service-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;

    const lostReport = await prisma.report.create({
      data: {
        userId,
        reportType: "lost",
        status: "published",
        title: "Perro perdido cerca de Once",
        imageUrl: "https://cdn.example.com/perdido.jpg",
      },
    });
    lostReportId = lostReport.id;

    const foundReport = await prisma.report.create({
      data: {
        userId,
        reportType: "found",
        status: "published",
        title: "Perro encontrado en Once",
        imageUrl: "https://cdn.example.com/encontrado.jpg",
      },
    });
    foundReportId = foundReport.id;

    await prisma.reportMatch.create({
      data: {
        reportLostId: lostReportId,
        reportFoundId: foundReportId,
        similarityScore: 0.83,
        status: "pending",
      },
    });
  });

  afterAll(async () => {
    await prisma.reportMatch.deleteMany({ where: { reportLostId: lostReportId, reportFoundId: foundReportId } });
    await prisma.report.deleteMany({ where: { id: { in: [lostReportId, foundReportId] } } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test("listMatches() consultado desde el reporte lost devuelve los datos del reporte found", async () => {
    const matches = await listMatches(lostReportId);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      reportId: foundReportId,
      title: "Perro encontrado en Once",
      imageUrl: "https://cdn.example.com/encontrado.jpg",
      reportType: "found",
      similarityScore: 0.83,
      status: "pending",
    });
    expect(matches[0].createdAt).toBeInstanceOf(Date);
  });

  test("listMatches() consultado desde el reporte found devuelve los datos del reporte lost", async () => {
    const matches = await listMatches(foundReportId);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      reportId: lostReportId,
      title: "Perro perdido cerca de Once",
      imageUrl: "https://cdn.example.com/perdido.jpg",
      reportType: "lost",
      similarityScore: 0.83,
      status: "pending",
    });
  });

  test("listMatches() devuelve un array vacío si el reporte no tiene matches", async () => {
    const otherReport = await prisma.report.create({
      data: { userId, reportType: "lost", status: "published", title: "Sin matches" },
    });

    const matches = await listMatches(otherReport.id);
    expect(matches).toEqual([]);

    await prisma.report.delete({ where: { id: otherReport.id } });
  });
});
