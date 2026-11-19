import {
  triggerEmbeddingGeneration,
  listMatches,
  reconcilePendingReports,
  confirmMatch,
  rejectMatch,
} from "../../src/services/matching.service";
import * as notificationsService from "../../src/services/notifications.service";
import * as reportMatchingService from "../../src/services/report-matching.service";
import { prisma } from "../../src/db/client";

// respuestas de POST /images/embedding del Backend IA
const VECTOR = Array.from({ length: 768 }, (_, i) => i / 768);
const petResponse = () => ({ status: 200, json: async () => ({ has_animal: true, embedding: VECTOR }) });
const noPetResponse = () => ({ status: 200, json: async () => ({ has_animal: false, embedding: null }) });

describe("matching.service", () => {
  const originalEnv = { ...process.env };
  const IMAGE_URL = "https://pub-test.r2.dev/pets/foto.jpg";
  let fetchMock: jest.Mock;
  let updateManySpy: jest.SpyInstance;
  let notifySpy: jest.SpyInstance;
  let saveEmbeddingSpy: jest.SpyInstance;
  let findMatchesSpy: jest.SpyInstance;

  beforeEach(() => {
    // las imágenes tienen que venir del bucket R2 (#229)
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    fetchMock = jest.fn();
    // test double: no necesita implementar el tipo completo de fetch
    global.fetch = fetchMock;
    // Mockeados: el id 42 puede existir en la base de desarrollo compartida.
    updateManySpy = jest.spyOn(prisma.report, "updateMany").mockResolvedValue({ count: 1 });
    notifySpy = jest.spyOn(notificationsService, "createForStatusChange").mockResolvedValue(null);
    saveEmbeddingSpy = jest.spyOn(reportMatchingService, "saveReportEmbedding").mockResolvedValue(true);
    findMatchesSpy = jest.spyOn(reportMatchingService, "findAndStoreMatches").mockResolvedValue(0);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    // Si un test con timers falsos falla antes de restaurarlos, no contamina al siguiente.
    jest.useRealTimers();
  });

  test("no llama a fetch si AI_SERVICE_URL no está configurada", () => {
    delete process.env.AI_SERVICE_URL;

    triggerEmbeddingGeneration(1, IMAGE_URL);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("hace POST a AI_SERVICE_URL/images/embedding con el body correcto", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    // Valor propio del test: no depender de lo que traiga el .env local
    // (afterEach restaura el entorno original).
    process.env.INTERNAL_API_KEY = "clave-interna-test";
    fetchMock.mockResolvedValue(petResponse());

    await triggerEmbeddingGeneration(42, IMAGE_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/images/embedding", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": "clave-interna-test" },
      body: JSON.stringify({ image_url: IMAGE_URL }),
    });
  });

  test("mascota detectada: guarda el embedding, busca matches y publica el reporte solo si sigue pending", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue(petResponse());

    await triggerEmbeddingGeneration(42, IMAGE_URL);

    expect(saveEmbeddingSpy).toHaveBeenCalledWith(42, IMAGE_URL, VECTOR);
    expect(findMatchesSpy).toHaveBeenCalledWith(42);
    // publishedAt se sella recien acá, no en la creación del reporte.
    expect(updateManySpy).toHaveBeenCalledWith({
      where: { id: 42, status: "pending", imageUrl: IMAGE_URL },
      data: { status: "published", publishedAt: expect.any(Date) },
    });
    expect(saveEmbeddingSpy.mock.invocationCallOrder[0]).toBeLessThan(findMatchesSpy.mock.invocationCallOrder[0]);
    expect(findMatchesSpy.mock.invocationCallOrder[0]).toBeLessThan(updateManySpy.mock.invocationCallOrder[0]);
  });

  test("sin mascota (has_animal false): rechaza el reporte solo si sigue pending, sin guardar embedding", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue(noPetResponse());

    await triggerEmbeddingGeneration(42, IMAGE_URL);

    expect(updateManySpy).toHaveBeenCalledWith({
      where: { id: 42, status: "pending", imageUrl: IMAGE_URL },
      data: { status: "rejected" },
    });
    expect(saveEmbeddingSpy).not.toHaveBeenCalled();
    expect(findMatchesSpy).not.toHaveBeenCalled();
  });

  test("422 (imagen no disponible) no es un veredicto: no reintenta ni toca el status", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue({ status: 422 });

    await triggerEmbeddingGeneration(42, IMAGE_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updateManySpy).not.toHaveBeenCalled();
  });

  test("un 200 con cuerpo inválido es inconcluso: deja el reporte en pending", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ has_animal: true, embedding: [0.1] }) });

    await triggerEmbeddingGeneration(42, IMAGE_URL);

    expect(saveEmbeddingSpy).not.toHaveBeenCalled();
    expect(updateManySpy).not.toHaveBeenCalled();
  });

  test("si falla la búsqueda de matches se loguea y el reporte se publica igual", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue(petResponse());
    const matchingError = new Error("matching search down");
    findMatchesSpy.mockRejectedValue(matchingError);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(triggerEmbeddingGeneration(42, IMAGE_URL)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("fallo al buscar matches"), matchingError);
    expect(updateManySpy.mock.calls[0][0].data.status).toBe("published");
  });

  test("si el reporte ya no muestra la imagen analizada no busca matches", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue(petResponse());
    saveEmbeddingSpy.mockResolvedValue(false);

    await triggerEmbeddingGeneration(42, IMAGE_URL);

    expect(findMatchesSpy).not.toHaveBeenCalled();
  });

  // If the owner swaps the photo while a verdict is in flight, the verdict for
  // the old photo must not decide the new one (PR #195 review).
  test("a verdict for a photo the report no longer shows changes nothing", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue(noPetResponse());
    updateManySpy.mockResolvedValue({ count: 0 });

    await triggerEmbeddingGeneration(42, "https://pub-test.r2.dev/pets/foto-vieja.jpg");

    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ imageUrl: "https://pub-test.r2.dev/pets/foto-vieja.jpg" }) })
    );
    expect(notifySpy).not.toHaveBeenCalled();
  });

  test("si falla el aviso al dueño se loguea y el pipeline termina igual", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValue(petResponse());
    const notifyError = new Error("db caída");
    notifySpy.mockRejectedValue(notifyError);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(triggerEmbeddingGeneration(42, IMAGE_URL)).resolves.toBeUndefined();

    expect(updateManySpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("no se pudo avisar"), notifyError);
    // No se confunde con una falla del Backend IA: el reporte ya quedó publicado.
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining("queda en pending"), expect.anything());
  });

  test("un 5xx es transitorio: reintenta y publica si un intento posterior detecta la mascota", async () => {
    jest.useFakeTimers();
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock.mockResolvedValueOnce({ status: 503 }).mockResolvedValueOnce(petResponse());

    triggerEmbeddingGeneration(42, IMAGE_URL);
    await jest.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(updateManySpy).toHaveBeenCalledTimes(1);
    expect(updateManySpy.mock.calls[0][0].data.status).toBe("published");
    jest.useRealTimers();
  });

  test("otro 4xx no es un veredicto de moderación: no reintenta ni toca el status", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue({ status: 400 });

    expect(() => triggerEmbeddingGeneration(42, IMAGE_URL)).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updateManySpy).not.toHaveBeenCalled();
  });

  test("un 401 del Backend IA (auth interna mal configurada) deja el reporte en pending", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue({ status: 401 });

    await triggerEmbeddingGeneration(42, IMAGE_URL);

    // Un 401 es un problema de configuracion (INTERNAL_API_KEY que no coincide
    // entre los dos servicios), no un veredicto de moderacion: no se publica ni
    // se rechaza el reporte, y no se reintenta porque reintentar no lo arregla.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updateManySpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("INTERNAL_API_KEY"));
  });

  // #266: los tres delays se esperan de verdad (intento inicial + 3 reintentos)
  test("ante fallas de red reintenta tras 1 s, 5 s y 30 s y deja el reporte en pending", async () => {
    jest.useFakeTimers();
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error("network down"));

    const done = triggerEmbeddingGeneration(1, IMAGE_URL);
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await jest.advanceTimersByTimeAsync(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    await jest.runAllTimersAsync();
    await done;
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // Una caída del Backend IA no es un veredicto de moderación: rechazar acá
    // descartaría reportes legítimos de forma permanente y silenciosa.
    expect(updateManySpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("tras 4 intentos"), expect.any(Error));
    jest.useRealTimers();
  });

  test("agotar los reintentos por 5xx deja el reporte en pending", async () => {
    jest.useFakeTimers();
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue({ status: 502 });

    triggerEmbeddingGeneration(1, IMAGE_URL);
    await jest.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(4);
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
        imageUrl: "https://pub-test.r2.dev/pets/caballito.jpg",
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
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
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

  const storedEmbeddings = (reportId: number) => prisma.$queryRaw<{ report_id: number }[]>`
    SELECT report_id FROM report_embeddings WHERE report_id = ${reportId}
  `;

  test("con mascota: guarda el embedding, publica el reporte, sella publishedAt y avisa una vez al dueño", async () => {
    fetchMock.mockResolvedValue(petResponse());
    const report = await createReport();

    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.status).toBe("published");
    expect(stored.publishedAt).toBeInstanceOf(Date);
    const notifications = await ownerStatusNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ reportId: report.id, title: "Tu reporte fue publicado" });
    await expect(storedEmbeddings(report.id)).resolves.toHaveLength(1);
  });

  test("si falla la búsqueda de matches el embedding queda guardado y el reporte se publica", async () => {
    fetchMock.mockResolvedValue(petResponse());
    jest.spyOn(reportMatchingService, "findAndStoreMatches").mockRejectedValue(new Error("matching search down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const report = await createReport();

    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.status).toBe("published");
    await expect(storedEmbeddings(report.id)).resolves.toHaveLength(1);
  });

  test("sin mascota: rechaza el reporte, no guarda embedding y avisa una vez al dueño", async () => {
    fetchMock.mockResolvedValue(noPetResponse());
    const report = await createReport();

    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.status).toBe("rejected");
    expect(stored.publishedAt).toBeNull();
    const notifications = await ownerStatusNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ reportId: report.id, title: "Tu reporte no fue publicado" });
    await expect(storedEmbeddings(report.id)).resolves.toHaveLength(0);
  });

  test("422 (imagen no disponible): el reporte queda pending y no se avisa", async () => {
    fetchMock.mockResolvedValue({ status: 422 });
    jest.spyOn(console, "error").mockImplementation(() => {});
    const report = await createReport();

    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.status).toBe("pending");
    await expect(ownerStatusNotifications()).resolves.toHaveLength(0);
  });

  test("procesar el mismo reporte dos veces (reintento o reconciliación) avisa una sola vez", async () => {
    fetchMock.mockResolvedValue(petResponse());
    const report = await createReport();

    await triggerEmbeddingGeneration(report.id, report.imageUrl);
    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    await expect(ownerStatusNotifications()).resolves.toHaveLength(1);
  });

  test("dos procesamientos concurrentes del mismo reporte avisan una sola vez", async () => {
    fetchMock.mockResolvedValue(petResponse());
    const report = await createReport();

    await Promise.all([
      triggerEmbeddingGeneration(report.id, report.imageUrl),
      triggerEmbeddingGeneration(report.id, report.imageUrl),
    ]);

    await expect(ownerStatusNotifications()).resolves.toHaveLength(1);
  });

  test("un veredicto tardío no pisa un reporte que ya salió de pending ni avisa", async () => {
    fetchMock.mockResolvedValue(petResponse());
    const report = await createReport("resolved");

    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.status).toBe("resolved");
    await expect(ownerStatusNotifications()).resolves.toHaveLength(0);
  });

  test("401: el reporte queda pending y no se avisa", async () => {
    fetchMock.mockResolvedValue({ status: 401 });
    jest.spyOn(console, "error").mockImplementation(() => {});
    const report = await createReport();

    await triggerEmbeddingGeneration(report.id, report.imageUrl);

    const stored = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(stored.status).toBe("pending");
    await expect(ownerStatusNotifications()).resolves.toHaveLength(0);
  });

  test("5xx en todos los intentos: el reporte queda pending y no se avisa", async () => {
    fetchMock.mockResolvedValue({ status: 503 });
    jest.spyOn(console, "error").mockImplementation(() => {});
    const report = await createReport();

    // Timers falsos solo para saltear los delays de reintento; Prisma no corre en ese tramo.
    jest.useFakeTimers();
    const done = triggerEmbeddingGeneration(report.id, report.imageUrl);
    await jest.runAllTimersAsync();
    await done;
    jest.useRealTimers();

    expect(fetchMock).toHaveBeenCalledTimes(4);
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
        imageUrl: "https://pub-test.r2.dev/pets/perdido.jpg",
      },
    });
    lostReportId = lostReport.id;

    const foundReport = await prisma.report.create({
      data: {
        userId,
        reportType: "found",
        status: "published",
        title: "Perro encontrado en Once",
        imageUrl: "https://pub-test.r2.dev/pets/encontrado.jpg",
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
      imageUrl: "https://pub-test.r2.dev/pets/encontrado.jpg",
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
      imageUrl: "https://pub-test.r2.dev/pets/perdido.jpg",
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

describe("matching.service confirmMatch y listMatches con estado del otro reporte (#221)", () => {
  let ownerAId: number;
  let ownerBId: number;
  let lostId: number;
  let foundId: number;
  let matchId: number;

  beforeEach(async () => {
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    ownerAId = (await prisma.user.create({ data: { email: `m221-a-${stamp}@example.com`, passwordHash: "h" } })).id;
    ownerBId = (await prisma.user.create({ data: { email: `m221-b-${stamp}@example.com`, passwordHash: "h" } })).id;
    lostId = (
      await prisma.report.create({
        data: { userId: ownerAId, reportType: "lost", status: "published", title: "Perdido 221" },
      })
    ).id;
    foundId = (
      await prisma.report.create({
        data: { userId: ownerBId, reportType: "found", status: "published", title: "Encontrado 221" },
      })
    ).id;
    matchId = (
      await prisma.reportMatch.create({
        data: { reportLostId: lostId, reportFoundId: foundId, similarityScore: 0.8, status: "pending" },
      })
    ).id;
  });

  afterEach(async () => {
    await prisma.notification.deleteMany({ where: { userId: { in: [ownerAId, ownerBId] } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: [ownerAId, ownerBId] } } });
    await prisma.reportMatch.deleteMany({ where: { id: matchId } });
    await prisma.report.deleteMany({ where: { id: { in: [lostId, foundId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerAId, ownerBId] } } });
  });

  test("confirmMatch() notifica al autor del otro reporte, apuntando al reporte de quien confirmó", async () => {
    await confirmMatch(lostId, matchId, ownerAId);

    const notifications = await prisma.notification.findMany({ where: { userId: ownerBId } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ type: "match_confirmed", reportId: lostId, isRead: false });
  });

  test("confirmMatch() no notifica a quien confirma", async () => {
    await confirmMatch(lostId, matchId, ownerAId);

    expect(await prisma.notification.count({ where: { userId: ownerAId } })).toBe(0);
  });

  test("confirmMatch() respeta la preferencia notifyMatch desactivada de la otra parte", async () => {
    await prisma.notificationPreference.create({ data: { userId: ownerBId, notifyMatch: false } });

    await confirmMatch(lostId, matchId, ownerAId);

    expect(await prisma.notification.count({ where: { userId: ownerBId } })).toBe(0);
  });

  test("rejectMatch() no genera notificaciones", async () => {
    await rejectMatch(lostId, matchId, ownerAId);

    expect(await prisma.notification.count({ where: { userId: { in: [ownerAId, ownerBId] } } })).toBe(0);
  });

  test("una decisión repetida (409) no duplica la notificación", async () => {
    await confirmMatch(lostId, matchId, ownerAId);
    await expect(confirmMatch(lostId, matchId, ownerAId)).rejects.toMatchObject({ statusCode: 409 });

    expect(await prisma.notification.count({ where: { userId: ownerBId } })).toBe(1);
  });

  test.each(["rejected", "hidden", "pending"] as const)(
    "listMatches() no muestra coincidencias con un reporte en estado %s",
    async (status) => {
      await prisma.report.update({ where: { id: foundId }, data: { status } });

      expect(await listMatches(lostId)).toEqual([]);
    }
  );

  test.each(["published", "resolved"] as const)(
    "listMatches() muestra coincidencias con un reporte en estado %s",
    async (status) => {
      await prisma.report.update({ where: { id: foundId }, data: { status } });

      const matches = await listMatches(lostId);
      expect(matches).toHaveLength(1);
      expect(matches[0].reportId).toBe(foundId);
    }
  );
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
  let externoId: number;

  const MINUTO = 60 * 1000;
  const HORA = 60 * MINUTO;
  const DIA = 24 * HORA;

  // URLs únicas por corrida: todos los reportes van al mismo endpoint y se distinguen por la imagen
  const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const image = (name: string) => `https://pub-test.r2.dev/pets/${name}-${stamp}.jpg`;
  const calledImages = () =>
    fetchMock.mock.calls.map((call) => JSON.parse((call[1] as RequestInit).body as string).image_url as string);

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
          imageUrl: image("atascado"),
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
        data: { ...base, title: "Recién creado", imageUrl: image("nuevo") },
      })
    ).id;

    // Fuera de la ventana: reintentar no lo va a arreglar, queda para revisión manual.
    demasiadoViejoId = (
      await prisma.report.create({
        data: {
          ...base,
          title: "Demasiado viejo",
          imageUrl: image("viejo"),
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
          imageUrl: image("editado"),
          createdAt: new Date(Date.now() - 3 * DIA),
          updatedAt: new Date(Date.now() - 22 * HORA),
        },
      })
    ).id;

    // Guardado antes de #229 con una URL fuera del bucket: no se le pide nada a la IA.
    externoId = (
      await prisma.report.create({
        data: {
          ...base,
          title: "Externo",
          imageUrl: "https://evil.com/externo.jpg",
          createdAt: new Date(Date.now() - 3 * DIA),
          updatedAt: new Date(Date.now() - 22 * HORA),
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.report.deleteMany({
      where: { id: { in: [stuckId, recienCreadoId, demasiadoViejoId, sinImagenId, editadoRecienId, externoId] } },
    });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // veredicto "sin mascota": no guarda embeddings y el updateMany mockeado no cambia nada
    fetchMock = jest.fn().mockResolvedValue(noPetResponse());
    // test double: no necesita implementar el tipo completo de fetch
    global.fetch = fetchMock;
    // OBLIGATORIO: reconcilePendingReports() barre toda la tabla `reports`, no
    // solo las filas que siembra este test. Sin este mock, un fetch con
    // veredicto publicaría de verdad cualquier reporte pending que la base
    // de desarrollo compartida tenga acumulado (y avisaría a sus dueños). Con
    // count 0 no cambia ningún estado ni se crea ninguna notificación. No
    // des-mockear dentro de un test.
    jest.spyOn(prisma.report, "updateMany").mockResolvedValue({ count: 0 });
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
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
    expect(calledImages()).toContain(image("atascado"));
    expect(calledImages()).toContain(image("editado"));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/images/embedding",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ image_url: image("atascado") }),
      })
    );

    // Dentro del grace period, fuera de la ventana, o sin imagen: no se tocan.
    expect(calledImages()).not.toContain(image("nuevo"));
    expect(calledImages()).not.toContain(image("viejo"));
    expect(calledImages().every(Boolean)).toBe(true);
  });

  test("no reencola un reporte guardado con una URL fuera del bucket", async () => {
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await reconcilePendingReports();
    await new Promise((resolve) => setImmediate(resolve));

    expect(calledImages()).not.toContain("https://evil.com/externo.jpg");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(`report ${externoId}`));
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

      expect(calledImages()).not.toContain(image("atascado"));
    } finally {
      await prisma.$executeRaw`UPDATE reports SET status = 'pending'::report_status WHERE id = ${stuckId}`;
    }
  });
});

// #229: una URL guardada fuera del bucket no se le manda a la IA
describe("triggerEmbeddingGeneration con URLs guardadas fuera del bucket R2", () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;
  let updateManySpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
    process.env.AI_SERVICE_URL = "http://localhost:8000";
    fetchMock = jest.fn().mockResolvedValue(noPetResponse());
    // test double: no necesita implementar el tipo completo de fetch
    global.fetch = fetchMock;
    updateManySpy = jest.spyOn(prisma.report, "updateMany").mockResolvedValue({ count: 1 });
    jest.spyOn(notificationsService, "createForStatusChange").mockResolvedValue(null);
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test.each([
    "https://evil.com/foto.jpg",
    "http://169.254.169.254/latest/meta-data/",
    "https://pub-test.r2.dev\\@evil.com/foto.jpg",
    "https://evil.com@pub-test.r2.dev/foto.jpg",
  ])("no hace ningún request, avisa y no toca el reporte: %s", async (imageUrl) => {
    await triggerEmbeddingGeneration(42, imageUrl);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateManySpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("report 42"));
  });

  test("manda la URL del bucket normalizada y aplica el veredicto sobre la URL guardada", async () => {
    await triggerEmbeddingGeneration(42, "HTTPS://PUB-TEST.r2.dev/pets/foto.jpg");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/images/embedding",
      expect.objectContaining({ body: JSON.stringify({ image_url: "https://pub-test.r2.dev/pets/foto.jpg" }) })
    );
    expect(updateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 42, status: "pending", imageUrl: "HTTPS://PUB-TEST.r2.dev/pets/foto.jpg" } })
    );
  });
});
