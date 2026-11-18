import { prisma } from "../../src/db/client";
import * as notificationsService from "../../src/services/notifications.service";
import {
  runInactivitySweep,
  startInactivitySweep,
  markWarningsRead,
  touchActivity,
  INACTIVITY_WARNING_1_DAYS,
  INACTIVITY_WARNING_2_DAYS,
  INACTIVITY_CLOSE_DAYS,
  INACTIVITY_CLOSE_GRACE_MS,
} from "../../src/services/report-inactivity.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-12-01T12:00:00.000Z");
const daysAgo = (days: number, from: Date = NOW) => new Date(from.getTime() - days * DAY_MS);

type Where = Record<string, unknown>;

describe("report-inactivity.service", () => {
  let findManySpy: jest.SpyInstance;
  let updateManySpy: jest.SpyInstance;
  let warningSpy: jest.SpyInstance;
  let closedSpy: jest.SpyInstance;
  let notificationUpdateManySpy: jest.SpyInstance;
  let ids: { close: number[]; warn2: number[]; warn1: number[] };
  let claimCount: number;

  const passOf = (where: Where): "close" | "warn2" | "warn1" =>
    where.inactivityWarned37At === null ? "warn2" : "inactivityWarned30At" in where ? "warn1" : "close";

  beforeEach(() => {
    ids = { close: [], warn2: [], warn1: [] };
    claimCount = 1;
    findManySpy = jest
      .spyOn(prisma.report, "findMany")
      .mockImplementation((async (args: { where: Where }) =>
        ids[passOf(args.where)].map((id) => ({ id }))) as never);
    updateManySpy = jest.spyOn(prisma.report, "updateMany").mockImplementation((async () => ({ count: claimCount })) as never);
    notificationUpdateManySpy = jest
      .spyOn(prisma.notification, "updateMany")
      .mockImplementation((async () => ({ count: 1 })) as never);
    warningSpy = jest.spyOn(notificationsService, "notifyInactivityWarning").mockResolvedValue(null);
    closedSpy = jest.spyOn(notificationsService, "notifyInactivityClosed").mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test("usa los umbrales 30, 37 y 38 días", () => {
    expect([INACTIVITY_WARNING_1_DAYS, INACTIVITY_WARNING_2_DAYS, INACTIVITY_CLOSE_DAYS]).toEqual([30, 37, 38]);
  });

  test("solo procesa reportes published y sin actividad desde cada umbral", async () => {
    await runInactivitySweep(NOW);

    const wheres = findManySpy.mock.calls.map(([args]) => args.where as Where);
    expect(wheres).toHaveLength(3);
    const close = wheres.find((w) => passOf(w) === "close")!;
    const warn2 = wheres.find((w) => passOf(w) === "warn2")!;
    const warn1 = wheres.find((w) => passOf(w) === "warn1")!;
    for (const where of wheres) expect(where.status).toBe("published");
    expect(close).toMatchObject({
      lastActivityAt: { lte: daysAgo(38) },
      inactivityWarned37At: { lte: new Date(NOW.getTime() - INACTIVITY_CLOSE_GRACE_MS) },
    });
    expect(warn2).toMatchObject({ inactivityWarned37At: null, lastActivityAt: { lte: daysAgo(37) } });
    expect(warn1).toMatchObject({ inactivityWarned30At: null, lastActivityAt: { lte: daysAgo(30), gt: daysAgo(37) } });
  });

  test("día 30: marca el aviso 1 y notifica una vez", async () => {
    ids.warn1 = [11];

    const result = await runInactivitySweep(NOW);

    expect(updateManySpy).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 11, status: "published", inactivityWarned30At: null }),
      data: { inactivityWarned30At: NOW },
    });
    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(warningSpy).toHaveBeenCalledWith(11, 30);
    expect(result).toEqual({ warned30: 1, warned37: 0, closed: 0 });
  });

  test("día 37: marca el aviso 2 y notifica una vez", async () => {
    ids.warn2 = [12];

    const result = await runInactivitySweep(NOW);

    expect(updateManySpy).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 12, status: "published", inactivityWarned37At: null }),
      data: { inactivityWarned30At: NOW, inactivityWarned37At: NOW },
    });
    expect(warningSpy).toHaveBeenCalledWith(12, 37);
    expect(result).toEqual({ warned30: 0, warned37: 1, closed: 0 });
  });

  test("día 38: cierra por inactividad (resolved, recuperable) y notifica", async () => {
    ids.close = [13];

    const result = await runInactivitySweep(NOW);

    expect(updateManySpy).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 13,
        status: "published",
        lastActivityAt: { lte: daysAgo(38) },
        inactivityWarned37At: { lte: new Date(NOW.getTime() - INACTIVITY_CLOSE_GRACE_MS) },
      }),
      data: { status: "resolved", closedReason: "inactivity", closedAt: NOW },
    });
    expect(closedSpy).toHaveBeenCalledWith(13);
    expect(result).toEqual({ warned30: 0, warned37: 0, closed: 1 });
  });

  test("45 días sin actividad y sin avisos: avisa y no cierra", async () => {
    ids.warn2 = [31];

    const result = await runInactivitySweep(NOW);

    expect(warningSpy).toHaveBeenCalledWith(31, 37);
    expect(closedSpy).not.toHaveBeenCalled();
    expect(updateManySpy.mock.calls.some(([a]) => a.data.status === "resolved")).toBe(false);
    expect(result).toEqual({ warned30: 0, warned37: 1, closed: 0 });
  });

  test("cierra solo si el aviso 2 es anterior al tiempo mínimo de gracia", async () => {
    await runInactivitySweep(NOW);

    const closeWhere = findManySpy.mock.calls.map(([a]) => a.where as Where).find((w) => passOf(w) === "close")!;
    const limit = (closeWhere.inactivityWarned37At as { lte: Date }).lte;
    const justWarned = NOW;
    const warnedBeforeGrace = new Date(NOW.getTime() - INACTIVITY_CLOSE_GRACE_MS - 1000);
    expect(justWarned.getTime() <= limit.getTime()).toBe(false);
    expect(warnedBeforeGrace.getTime() <= limit.getTime()).toBe(true);
  });

  test("excluye autores con suspensión vigente en la búsqueda y en el reclamo condicional", async () => {
    ids = { close: [1], warn2: [2], warn1: [3] };

    await runInactivitySweep(NOW);

    for (const [args] of findManySpy.mock.calls) {
      expect(args.where.user).toEqual({ accountSanctions: { none: expect.anything() } });
    }
    expect(updateManySpy.mock.calls.length).toBe(3);
    for (const [args] of updateManySpy.mock.calls) {
      expect(args.where.user).toEqual({ accountSanctions: { none: expect.anything() } });
    }
  });

  test("el cierre por inactividad marca como leídos los avisos del reporte", async () => {
    ids.close = [13];

    await runInactivitySweep(NOW);

    expect(notificationUpdateManySpy).toHaveBeenCalledWith({
      where: { reportId: { in: [13] }, type: "inactivity_warning", isRead: false },
      data: { isRead: true },
    });
  });

  test("markWarningsRead solo toca avisos de inactividad no leídos de esos reportes", async () => {
    await markWarningsRead([7, 8]);

    expect(notificationUpdateManySpy).toHaveBeenCalledWith({
      where: { reportId: { in: [7, 8] }, type: "inactivity_warning", isRead: false },
      data: { isRead: true },
    });
  });

  test("markWarningsRead es best-effort: un fallo se loguea y no se propaga", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    notificationUpdateManySpy.mockRejectedValue(new Error("boom"));

    await expect(markWarningsRead([7])).resolves.toBeUndefined();
  });

  test("touchActivity reinicia el contador y marca leídos solo los avisos de reportes que ya habían sido avisados", async () => {
    ids.warn1 = [5];

    await touchActivity([5, 6]);

    expect(updateManySpy).toHaveBeenCalledWith({
      where: { id: { in: [5, 6] } },
      data: expect.objectContaining({ inactivityWarned30At: null, inactivityWarned37At: null }),
    });
    expect(notificationUpdateManySpy).toHaveBeenCalledTimes(1);
    expect(notificationUpdateManySpy.mock.calls[0][0].where.reportId).toEqual({ in: [5] });
  });

  test("touchActivity no toca notificaciones si ningún reporte estaba avisado", async () => {
    await touchActivity([6]);

    expect(notificationUpdateManySpy).not.toHaveBeenCalled();
  });

  test("idempotente: si otra instancia ya tomó el reporte (count 0) no notifica", async () => {
    ids = { close: [1], warn2: [2], warn1: [3] };
    claimCount = 0;

    const result = await runInactivitySweep(NOW);

    expect(warningSpy).not.toHaveBeenCalled();
    expect(closedSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ warned30: 0, warned37: 0, closed: 0 });
  });

  test("un fallo al notificar no frena el resto del barrido", async () => {
    ids.warn1 = [21, 22];
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    warningSpy.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(null);

    const result = await runInactivitySweep(NOW);

    expect(warningSpy).toHaveBeenCalledTimes(2);
    expect(result.warned30).toBe(2);
  });

  test("los umbrales son inyectables", async () => {
    await runInactivitySweep(NOW, { warning1Days: 1, warning2Days: 2, closeDays: 3 });

    const closeWhere = findManySpy.mock.calls.map(([a]) => a.where as Where).find((w) => passOf(w) === "close")!;
    expect(closeWhere.lastActivityAt).toEqual({ lte: daysAgo(3) });
  });

  test("startInactivitySweep ejecuta el barrido en el intervalo inyectado y tolera errores", async () => {
    jest.useFakeTimers();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    findManySpy.mockRejectedValue(new Error("db caída"));

    const timer = startInactivitySweep(1000);
    await jest.advanceTimersByTimeAsync(1000);
    clearInterval(timer);

    expect(findManySpy).toHaveBeenCalled();
  });
});
