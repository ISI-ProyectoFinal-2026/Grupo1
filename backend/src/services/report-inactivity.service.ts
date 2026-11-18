import { prisma } from "../db/client";
import * as notificationsService from "./notifications.service";

export const INACTIVITY_WARNING_1_DAYS = 30;
export const INACTIVITY_WARNING_2_DAYS = 37;
export const INACTIVITY_CLOSE_DAYS = 38;
// mínimo entre el aviso 2 y el cierre
export const INACTIVITY_CLOSE_GRACE_MS = 24 * 60 * 60 * 1000;
export const INACTIVITY_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export interface InactivityConfig {
  warning1Days: number;
  warning2Days: number;
  closeDays: number;
}

const DEFAULT_CONFIG: InactivityConfig = {
  warning1Days: INACTIVITY_WARNING_1_DAYS,
  warning2Days: INACTIVITY_WARNING_2_DAYS,
  closeDays: INACTIVITY_CLOSE_DAYS,
};

export interface InactivitySweepResult {
  warned30: number;
  warned37: number;
  closed: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

// reinicia el contador de inactividad y los avisos enviados
export function activityReset(now: Date = new Date()) {
  return { lastActivityAt: now, inactivityWarned30At: null, inactivityWarned37At: null };
}

// marca leídos los avisos de inactividad (ya no son ciertos); un fallo no deshace la operación
export async function markWarningsRead(reportIds: number[]): Promise<void> {
  if (reportIds.length === 0) return;
  try {
    await prisma.notification.updateMany({
      where: { reportId: { in: reportIds }, type: "inactivity_warning", isRead: false },
      data: { isRead: true },
    });
  } catch (error) {
    console.error(`[inactividad] no se pudieron marcar leídos los avisos de ${reportIds.join(",")}:`, error);
  }
}

// registra actividad; solo toca notificaciones de reportes que ya habían sido avisados (lectura por PK)
export async function touchActivity(reportIds: number[]): Promise<void> {
  if (reportIds.length === 0) return;
  const warned = await prisma.report.findMany({
    where: { id: { in: reportIds }, inactivityWarned30At: { not: null } },
    select: { id: true },
  });
  await prisma.report.updateMany({ where: { id: { in: reportIds } }, data: activityReset() });
  await markWarningsRead(warned.map((row) => row.id));
}

// toma cada reporte con escritura condicional: con varias instancias solo una avisa o cierra
async function claimAndNotify(
  ids: number[],
  where: Record<string, unknown>,
  data: Record<string, unknown>,
  notify: (reportId: number) => Promise<unknown>
): Promise<number> {
  let claimed = 0;
  for (const id of ids) {
    const { count } = await prisma.report.updateMany({ where: { id, status: "published", ...where }, data });
    if (count !== 1) continue;
    claimed++;
    try {
      await notify(id);
    } catch (error) {
      console.error(`[inactividad] no se pudo notificar el reporte ${id}:`, error);
    }
  }
  return claimed;
}

async function findIds(where: Record<string, unknown>): Promise<number[]> {
  const rows = await prisma.report.findMany({ where: { status: "published", ...where }, select: { id: true } });
  return rows.map((row) => row.id);
}

export async function runInactivitySweep(
  now: Date = new Date(),
  config: InactivityConfig = DEFAULT_CONFIG
): Promise<InactivitySweepResult> {
  const closeCutoff = daysBefore(now, config.closeDays);
  const warn2Cutoff = daysBefore(now, config.warning2Days);
  const warn1Cutoff = daysBefore(now, config.warning1Days);

  // cierre (día 38): exige el aviso 2 enviado con al menos el tiempo de gracia
  const closeWhere = {
    lastActivityAt: { lte: closeCutoff },
    inactivityWarned37At: { lte: new Date(now.getTime() - INACTIVITY_CLOSE_GRACE_MS) },
  };
  const closed = await claimAndNotify(
    await findIds(closeWhere),
    closeWhere,
    { status: "resolved", closedReason: "inactivity", closedAt: now },
    async (id) => {
      await markWarningsRead([id]);
      await notificationsService.notifyInactivityClosed(id);
    }
  );

  // segundo aviso (día 37 o posterior); marca también el primero para no enviarlo después
  const warn2Where = { inactivityWarned37At: null, lastActivityAt: { lte: warn2Cutoff } };
  const warned37 = await claimAndNotify(
    await findIds(warn2Where),
    warn2Where,
    { inactivityWarned30At: now, inactivityWarned37At: now },
    (id) => notificationsService.notifyInactivityWarning(id, 37)
  );

  // primer aviso (día 30)
  const warn1Where = { inactivityWarned30At: null, lastActivityAt: { lte: warn1Cutoff, gt: warn2Cutoff } };
  const warned30 = await claimAndNotify(
    await findIds(warn1Where),
    warn1Where,
    { inactivityWarned30At: now },
    (id) => notificationsService.notifyInactivityWarning(id, 30)
  );

  return { warned30, warned37, closed };
}

export function startInactivitySweep(
  intervalMs: number = INACTIVITY_SWEEP_INTERVAL_MS,
  config: InactivityConfig = DEFAULT_CONFIG
): NodeJS.Timeout {
  const timer = setInterval(() => {
    runInactivitySweep(new Date(), config).catch((error) => {
      console.error("[inactividad] falló el barrido de reportes inactivos:", error);
    });
  }, intervalMs);
  timer.unref();
  return timer;
}
