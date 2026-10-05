import { triggerEmbeddingGeneration, listMatches, reconcilePendingReports } from "../../src/services/matching.service";
import * as notificationsService from "../../src/services/notifications.service";
import { prisma } from "../../src/db/client";

describe("matching.service", () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;
  let updateManySpy: jest.SpyInstance;
  let notifySpy: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.fn();
    // test double: no necesita implementar el tipo completo de fetch
    global.fetch = fetchMock;
    // Mockeados: el id 42 puede existir en la base de desarrollo compartida.
    updateManySpy = jest.spyOn(prisma.report, "updateMany").mockResolvedValue({ count: 1 });
    notifySpy = jest.spyOn(notificationsService, "createForStatusChange").mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    // Si un test con timers falsos falla antes de restaurarlos, no contamina al siguiente.
    jest.useRealTimers();
  });

  test("no llama a fetch si AI_SERVICE_URL no está configurada", () => {
    delete process.env.AI_SERVICE_URL;

    triggerEmbeddingGeneration(1, "https://cdn.example.com/foto.jpg");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("hace POST a AI_SERVICE_URL/reports/:id/embedding con el body correcto", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    // Valor propio del test: no depender de lo que traiga el .env local
    // (afterEach restaura el entorno original).
    process.env.INTERNAL_API_KEY = "clave-interna-test";
    fetchMock.mockResolvedValue({ status: 201 });

    triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/reports/42/embedding", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": "clave-interna-test" },
      body: JSON.stringify({ image_url: "https://cdn.example.com/foto.jpg" }),
    });

    // deja que la resolución interna del fetch procese antes de que termine el test
    await new Promise((resolve) => setImmediate(resolve));
  });

  test("fetch resuelve con status 201 (mascota detectada) -> publica el reporte solo si sigue pending", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 201 });

    await triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg");

    // publishedAt se sella recien acá, no en la creación del reporte.
    expect(updateManySpy).toHaveBeenCalledWith({
      where: { id: 42, status: "pending", imageUrl: "https://cdn.example.com/foto.jpg" },
      data: { status: "published", publishedAt: expect.any(Date) },
    });
  });

  test("fetch resuelve con status 422 (sin mascota detectada) -> rechaza el reporte solo si sigue pending", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 422 });

    await triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg");

    expect(updateManySpy).toHaveBeenCalledWith({
      where: { id: 42, status: "pending", imageUrl: "https://cdn.example.com/foto.jpg" },
      data: { status: "rejected" },
    });
  });

  // If the owner swaps the photo while a verdict is in flight, the verdict for
  // the old photo must not decide the new one (PR #195 review).
  test("a verdict for a photo the report no longer shows changes nothing", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 201 });
    updateManySpy.mockResolvedValue({ count: 0 });
    const notifySpy = jest.spyOn(notificationsService, "createForStatusChange");

    await triggerEmbeddingGeneration(42, "https://cdn.example.com/foto-vieja.jpg");

    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ imageUrl: "https://cdn.example.com/foto-vieja.jpg" }) })
    );
    expect(notifySpy).not.toHaveBeenCalled();
  });

  test("si falla el aviso al dueño se loguea y el pipeline termina igual", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 201 });
    const notifyError = new Error("db caída");
    notifySpy.mockRejectedValue(notifyError);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg")).resolves.toBeUndefined();

    expect(updateManySpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("no se pudo avisar"), notifyError);
    // No se confunde con una falla del Backend IA: el reporte ya quedó publicado.
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining("queda en pending"), expect.anything());
  });

  test("un 5xx es transitorio: reintenta y publica si un intento posterior responde 201", async () => {
    jest.useFakeTimers();
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValueOnce({ status: 503 }).mockResolvedValueOnce({ status: 201 });

    triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg");
    await jest.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(updateManySpy).toHaveBeenCalledTimes(1);
    expect(updateManySpy.mock.calls[0][0].data.status).toBe("published");
    jest.useRealTimers();
  });

  test("un 4xx distinto de 422 no es un veredicto de moderación: no reintenta ni toca el status", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 400 });

    expect(() => triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg")).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updateManySpy).not.toHaveBeenCalled();
  });

  test("un 401 del Backend IA (auth interna mal configurada) deja el reporte en pending", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 401 });

    triggerEmbeddingGeneration(42, "https://cdn.example.com/foto.jpg");
    await new Promise((resolve) => setImmediate(resolve));

    // Un 401 es un problema de configuracion (INTERNAL_API_KEY que no coincide
    // entre los dos servicios), no un veredicto de moderacion: no se publica ni
    // se rechaza el reporte, y no se reintenta porque reintentar no lo arregla.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updateManySpy).not.toHaveBeenCalled();
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
    expect(updateManySpy).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test("agotar los reintentos por 5xx deja el reporte en pending", async () => {
    jest.useFakeTimers();
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue({ status: 502 });

    triggerEmbeddingGeneration(1, "https://cdn.example.com/foto.jpg");
    await jest.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(updateManySpy).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});

describe("triggerEmbeddingGeneration: veredicto de moderación y aviso al dueño (#182)", () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;
  let ownerId: number;
  const createdReportIds: number[] = [];

  async function createReport(status: "pending" | "resolved" = "pending") {
    const report = await prisma.report.create({
      data: {
        userId: ownerId,
        reportType: "lost",
        status,
        title: "Perra perdida en Caballito",
        imageUrl: "https://cdn.example.com/caballito.jpg",
      },
    });
    createdReportIds.push(report.id);
    return { id: report.id, imageUrl: report.imageUrl! };
  }

  const ownerStatusNotifications = () =>
    prisma.notification.findMany({ where: { userId: ownerId, type: "report_status_change" } });

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: { email: `matching-verdict-test-${Date.now()}@example.com`, passwordHash: "test-hash" },
    });
    ownerId = owner.id;
  });

  beforeEach(() => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock = jest.fn();
    // test double: no necesita implementar el tipo completo de fetch
    global.fetch = fetchMock;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    jest.useRealTimers();
    await prisma.notification.deleteMany({ where: { userId: ownerId } });
    await prisma.report.deleteMany({ where: { id: { in: createdReportIds.splice(0) } } });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: ownerId } });
    await prisma.$disconnect();
  });

  test("201: publica el reporte, sella publishedAt y avisa una vez al dueño", async () => {
    fetchMock.mockResolvedValue({ status: 201 });
    const report = await createReport();

    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.status).toBe("published");
    expect(stored.publishedAt).toBeInstanceOf(Date);
    const notifications = await ownerStatusNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ reportId: report.id, title: "Tu reporte fue publicado" });
  });

  test("422: rechaza el reporte y avisa una vez al dueño", async () => {
    fetchMock.mockResolvedValue({ status: 422 });
    const report = await createReport();

    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.status).toBe("rejected");
    expect(stored.publishedAt).toBeNull();
    const notifications = await ownerStatusNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ reportId: report.id, title: "Tu reporte no fue publicado" });
  });

  test("procesar el mismo reporte dos veces (reintento o reconciliación) avisa una sola vez", async () => {
    fetchMock.mockResolvedValue({ status: 201 });
    const report = await createReport();

    await triggerEmbeddingGeneration(report.id, report.imageUrl);
    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    await expect(ownerStatusNotifications()).resolves.toHaveLength(1);
  });

  test("dos procesamientos concurrentes del mismo reporte avisan una sola vez", async () => {
    fetchMock.mockResolvedValue({ status: 201 });
    const report = await createReport();

    await Promise.all([
      triggerEmbeddingGeneration(report.id, report.imageUrl),
      triggerEmbeddingGeneration(report.id, report.imageUrl),
    ]);

    await expect(ownerStatusNotifications()).resolves.toHaveLength(1);
  });

  test("un veredicto tardío no pisa un reporte que ya salió de pending ni avisa", async () => {
    fetchMock.mockResolvedValue({ status: 201 });
    const report = await createReport("resolved");

    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.status).toBe("resolved");
    await expect(ownerStatusNotifications()).resolves.toHaveLength(0);
  });

  test("401: el reporte queda pending y no se avisa", async () => {
    fetchMock.mockResolvedValue({ status: 401 });
    const report = await createReport();

    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.status).toBe("pending");
    await expect(ownerStatusNotifications()).resolves.toHaveLength(0);
  });

  test("5xx en todos los intentos: el reporte queda pending y no se avisa", async () => {
    fetchMock.mockResolvedValue({ status: 503 });
    const report = await createReport();

    // Timers falsos solo para saltear los delays de reintento; Prisma no corre en ese tramo.
    jest.useFakeTimers();
    const done = triggerEmbeddingGeneration(report.id, report.imageUrl);
    await jest.runAllTimersAsync();
    await done;
    jest.useRealTimers();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.status).toBe("pending");
    await expect(ownerStatusNotifications()).resolves.toHaveLength(0);
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
  let editadoRecienId: number;

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
          // Prisma completa @updatedAt con now() si no se lo pasa explícito.
          updatedAt: new Date(Date.now() - 23 * HORA),
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
          updatedAt: new Date(Date.now() - 3 * DIA),
        },
      })
    ).id;

    // Sin imagen no hay nada que procesar (esos nacen published, pero se
    // cubre igual para que la query no los tome nunca).
    sinImagenId = (
      await prisma.report.create({
        data: {
          ...base,
          title: "Sin imagen",
          createdAt: new Date(Date.now() - 10 * MINUTO),
          updatedAt: new Date(Date.now() - 10 * MINUTO),
        },
      })
    ).id;

    // Creado hace días pero con la foto cambiada después: update() lo volvió a
    // pending, así que la ventana cuenta desde la edición, no desde la
    // creación. Se lo siembra a 22h (y no recién editado) para que sea el
    // segundo más viejo y entre siempre en el batch de la base compartida.
    editadoRecienId = (
      await prisma.report.create({
        data: {
          ...base,
          title: "Editado recién",
          imageUrl: "https://cdn.example.com/editado.jpg",
          createdAt: new Date(Date.now() - 3 * DIA),
          updatedAt: new Date(Date.now() - 22 * HORA),
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.report.deleteMany({
      where: { id: { in: [stuckId, recienCreadoId, demasiadoViejoId, sinImagenId, editadoRecienId] } },
    });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ status: 201 });
    // test double: no necesita implementar el tipo completo de fetch
    global.fetch = fetchMock;
    // OBLIGATORIO: reconcilePendingReports() barre toda la tabla `reports`, no
    // solo las filas que siembra este test. Sin este mock, un fetch que
    // responde 201 publicaría de verdad cualquier reporte pending que la base
    // de desarrollo compartida tenga acumulado (y avisaría a sus dueños). Con
    // count 0 no cambia ningún estado ni se crea ninguna notificación. No
    // des-mockear dentro de un test.
    jest.spyOn(prisma.report, "updateMany").mockResolvedValue({ count: 0 });
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

  test("reencola los reportes atascados dentro de la ventana, contada desde que entraron a pending", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";

    const reencolados = await reconcilePendingReports();
    await new Promise((resolve) => setImmediate(resolve));

    // La base de desarrollo es compartida y puede tener otros reportes
    // atascados, así que se afirma sobre los reportes sembrados acá y no
    // sobre el total reencolado.
    expect(reencolados).toBeGreaterThanOrEqual(1);
    expect(calledUrls()).toContain(embeddingUrl(stuckId));
    expect(calledUrls()).toContain(embeddingUrl(editadoRecienId));
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
