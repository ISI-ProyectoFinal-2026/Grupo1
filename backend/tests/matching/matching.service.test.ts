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
      headers: { "Content-Type": "application/json", "X-Internal-Key": "" },
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

    // publishedAt se sella recien acá, no en la creación del reporte.
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { status: "published", publishedAt: expect.any(Date) },
    });
  });

  test("fetch resuelve con status 422 (sin mascota detectada) -> marca el reporte como rejected", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 422 });

    triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg");
    await new Promise((resolve) => setImmediate(resolve));

    expect(updateSpy).toHaveBeenCalledWith({ where: { id: 42 }, data: { status: "rejected" } });
  });

  test("un 5xx es transitorio: reintenta y publica si un intento posterior responde 201", async () => {
    jest.useFakeTimers();
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValueOnce({ status: 503 }).mockResolvedValueOnce({ status: 201 });

    triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg");
    await jest.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][0].data.status).toBe("published");
    jest.useRealTimers();
  });

  test("un 4xx distinto de 422 no es un veredicto de moderación: no reintenta ni toca el status", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 400 });

    expect(() => triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg")).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  test("agotar los reintentos por falla de red deja el reporte en pending, no lo rechaza", async () => {
    jest.useFakeTimers();
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockRejectedValue(new Error("network down"));

    expect(() => triggerEmbeddingGeneration(1, "https://cdn.example.com/foto.jpg")).not.toThrow();

    // avanza todos los timers de retry (1s + 5s) y espera que las promesas se resuelvan
    await jest.runAllTimersAsync();

    // Una caída del Backend IA no es un veredicto de moderación: rechazar acá
    // descartaría reportes legítimos de forma permanente y silenciosa.
    expect(updateSpy).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test("agotar los reintentos por 5xx deja el reporte en pending", async () => {
    jest.useFakeTimers();
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 502 });

    triggerEmbeddingGeneration(1, "https://cdn.example.com/foto.jpg");
    await jest.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(updateSpy).not.toHaveBeenCalled();
    jest.useRealTimers();
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
