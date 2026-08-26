import { triggerEmbeddingGeneration, listMatches, reconcilePendingReports } from "../../src/services/matching.service";
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

describe("matching.service reconcilePendingReports", () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;
  let userId: number;
  let stuckId: number;
  let recienCreadoId: number;
  let demasiadoViejoId: number;
  let sinImagenId: number;

  const MINUTO = 60 * 1000;
  const HORA = 60 * MINUTO;
  const DIA = 24 * HORA;

  const embeddingUrl = (id: number) => `http://localhost:8000/reports/${id}/embedding`;
  const calledUrls = () => fetchMock.mock.calls.map((call) => call[0] as string);

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `matching-reconcile-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    userId = user.id;

    const base = { userId, reportType: "lost" as const, status: "pending" as const };

    // Atascado: pasó el grace period de 2 min y todavía está dentro de la
    // ventana de 24h -> se debe reencolar. Se lo siembra casi en el borde de
    // la ventana (23h) para que sea el más viejo de los candidatos y quede
    // siempre dentro del batch, sin importar qué otros reportes pending tenga
    // la base de desarrollo compartida.
    stuckId = (
      await prisma.report.create({
        data: {
          ...base,
          title: "Atascado",
          imageUrl: "https://cdn.example.com/atascado.jpg",
          createdAt: new Date(Date.now() - 23 * HORA),
        },
      })
    ).id;

    // Recién creado: los reintentos en memoria todavía pueden estar corriendo,
    // reencolarlo ahora duplicaría la inferencia.
    recienCreadoId = (
      await prisma.report.create({
        data: { ...base, title: "Recién creado", imageUrl: "https://cdn.example.com/nuevo.jpg" },
      })
    ).id;

    // Fuera de la ventana: reintentar no lo va a arreglar, queda para revisión manual.
    demasiadoViejoId = (
      await prisma.report.create({
        data: {
          ...base,
          title: "Demasiado viejo",
          imageUrl: "https://cdn.example.com/viejo.jpg",
          createdAt: new Date(Date.now() - 3 * DIA),
        },
      })
    ).id;

    // Sin imagen no hay nada que procesar (esos nacen published, pero se
    // cubre igual para que la query no los tome nunca).
    sinImagenId = (
      await prisma.report.create({
        data: { ...base, title: "Sin imagen", createdAt: new Date(Date.now() - 10 * MINUTO) },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.report.deleteMany({
      where: { id: { in: [stuckId, recienCreadoId, demasiadoViejoId, sinImagenId] } },
    });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ status: 201 });
    // @ts-expect-error -- test double, no necesita implementar el tipo completo de fetch
    global.fetch = fetchMock;
    // OBLIGATORIO: reconcilePendingReports() barre toda la tabla `reports`, no
    // solo las filas que siembra este test. Sin este mock, un fetch que
    // responde 201 publicaría de verdad cualquier reporte pending que la base
    // de desarrollo compartida tenga acumulado. No des-mockear dentro de un test.
    jest.spyOn(prisma.report, "update").mockResolvedValue({} as never);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test("no hace nada si AI_SERVICE_URL no está configurada", async () => {
    delete process.env.AI_SERVICE_URL;

    await expect(reconcilePendingReports()).resolves.toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("reencola solo el reporte atascado dentro de la ventana, con su image_url", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";

    const reencolados = await reconcilePendingReports();
    await new Promise((resolve) => setImmediate(resolve));

    // La base de desarrollo es compartida y puede tener otros reportes
    // atascados, así que se afirma sobre los reportes sembrados acá y no
    // sobre el total reencolado.
    expect(reencolados).toBeGreaterThanOrEqual(1);
    expect(calledUrls()).toContain(embeddingUrl(stuckId));
    expect(fetchMock).toHaveBeenCalledWith(
      embeddingUrl(stuckId),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ image_url: "https://cdn.example.com/atascado.jpg" }),
      })
    );

    // Dentro del grace period, fuera de la ventana, o sin imagen: no se tocan.
    expect(calledUrls()).not.toContain(embeddingUrl(recienCreadoId));
    expect(calledUrls()).not.toContain(embeddingUrl(demasiadoViejoId));
    expect(calledUrls()).not.toContain(embeddingUrl(sinImagenId));
  });

  test("un reporte que ya fue publicado deja de reencolarse", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";

    // El status se cambia por SQL crudo a propósito: `prisma.report.update`
    // queda mockeado durante todo este describe para que la reconciliación no
    // pueda escribir sobre los reportes reales de la base de desarrollo
    // compartida (barre toda la tabla, no solo lo que siembra el test).
    await prisma.$executeRaw`UPDATE reports SET status = 'published'::report_status WHERE id = ${stuckId}`;
    try {
      await reconcilePendingReports();
      await new Promise((resolve) => setImmediate(resolve));

      expect(calledUrls()).not.toContain(embeddingUrl(stuckId));
    } finally {
      await prisma.$executeRaw`UPDATE reports SET status = 'pending'::report_status WHERE id = ${stuckId}`;
    }
  });
});
