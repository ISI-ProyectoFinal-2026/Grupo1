import { MatchStatus, Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { visibleAuthorSql } from "./account-sanctions/visibility";
import * as notificationsService from "./notifications.service";
import * as reportMatchingService from "./report-matching.service";
import { normalizeR2PublicUrl } from "./storage.service";
import { touchActivity } from "./report-inactivity.service";

/**
 * Moderación y matching de un reporte con imagen (ADR-0029): el Backend IA
 * solo infiere (`POST /images/embedding`) y este backend persiste el embedding,
 * busca los matches y resuelve el reporte. Asíncrono: la creación del
 * reporte nunca queda bloqueada ni falla por esto. Con REDIS_URL el pipeline
 * corre en el worker de la cola (report-pipeline.service.ts, #177).
 *
 * Moderación de contenido (POC, issue #19): solo un 200 bien formado es un
 * veredicto. Con mascota -> published (tras guardar el embedding y buscar
 * matches); sin mascota (`has_animal: false`) -> rejected.
 *
 * Cualquier otro resultado (422 por imagen no disponible, otro status, cuerpo
 * inválido o falla de red) es INCONCLUSO: se loguea y el reporte queda
 * "pending" para revisión manual, sin lanzar ni generar un unhandled rejection.
 * Rechazar ante una caída del Backend IA descartaría reportes legítimos de
 * forma permanente y silenciosa (issue #125).
 *
 * La actualización se hace acá con Prisma directo (no llamando de vuelta
 * a reports.service.ts) porque reports.service.ts ya importa este módulo;
 * llamar en sentido inverso crearía una dependencia circular.
 */
// delays entre intentos: intento inicial + un reintento por delay (#266)
const RETRY_DELAYS_MS = [1_000, 5_000, 30_000];

/**
 * Reintenta tanto ante una falla de red (fetch que rechaza) como ante un 5xx,
 * porque un 502/503 del Backend IA es igual de transitorio que un socket caído
 * y antes se descartaba en el primer intento. Un 4xx, en cambio, es una
 * respuesta deliberada del servicio: se devuelve tal cual, sin reintentar.
 *
 * Si se agotan los intentos con un 5xx se devuelve esa última respuesta, para
 * que el llamador la trate como inconclusa por la misma vía que cualquier otro
 * status inesperado.
 */
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let lastError: unknown;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status < 500) {
        return response;
      }
      lastResponse = response;
    } catch (err) {
      lastError = err;
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((res) => setTimeout(res, RETRY_DELAYS_MS[attempt]));
    }
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw lastError;
}

// Solo sale de pending una vez: un reintento o la reconciliación no lo pisan ni re-avisan.
// El veredicto vale solo para la imagen analizada: si el dueño cambió la foto
// mientras la inferencia estaba en vuelo, decide el veredicto de la foto nueva.
async function applyModerationVerdict(
  reportId: number,
  imageUrl: string,
  verdict: notificationsService.ModerationVerdict
): Promise<void> {
  const { count } = await prisma.report.updateMany({
    where: { id: reportId, status: "pending", imageUrl },
    // publishedAt se sella acá: hasta este momento el reporte nunca estuvo publicado.
    data: verdict === "published" ? { status: verdict, publishedAt: new Date() } : { status: verdict },
  });
  if (count === 0) return;

  try {
    await notificationsService.createForStatusChange(reportId, verdict);
  } catch (error) {
    console.error(`[matching] no se pudo avisar al dueño el cambio de estado del report ${reportId}:`, error);
  }

  if (verdict !== "published") return;
  try {
    await notificationsService.createForNearbyReport(reportId);
  } catch (error) {
    console.error(`[matching] no se pudieron generar los avisos de zona del report ${reportId}:`, error);
  }
}

// Guarda el embedding y busca matches antes de publicar; el matching es best-effort.
async function publishWithEmbedding(reportId: number, imageUrl: string, embedding: number[]): Promise<void> {
  if (await reportMatchingService.saveReportEmbedding(reportId, imageUrl, embedding)) {
    try {
      await reportMatchingService.findAndStoreMatches(reportId);
    } catch (error) {
      console.error(`[matching] fallo al buscar matches para report ${reportId}:`, error);
    }
  }
  await applyModerationVerdict(reportId, imageUrl, "published");
}

// Resuelve el veredicto de un 200 o loguea por qué el reporte queda en pending.
async function handleEmbeddingResponse(reportId: number, imageUrl: string, response: Response): Promise<void> {
  if (response.status === 200) {
    const result = parseImageEmbedding(await response.json());
    if (!result) {
      console.error(
        `[matching] respuesta inválida del Backend IA para report ${reportId}; queda en pending para revisión manual`
      );
    } else if (result.hasAnimal) {
      await publishWithEmbedding(reportId, imageUrl, result.embedding);
    } else {
      await applyModerationVerdict(reportId, imageUrl, "rejected");
    }
  } else if (response.status === 401) {
    // Se distingue del resto de los status inconclusos porque no es una
    // falla transitoria: reintentar no lo arregla nunca, hay que tocar
    // configuración. Sin este mensaje, el único síntoma visible es que
    // todos los reportes con imagen se quedan en pending sin explicación.
    console.error(
      `[matching] el Backend IA rechazó la autenticación interna (401) para report ${reportId}: ` +
        `INTERNAL_API_KEY no coincide entre backend/.env y backend-ia/.env, o falta en alguno de los dos. ` +
        `El reporte queda en pending hasta que se corrija la configuración (ver backend-ia/README.md)`
    );
  } else {
    // 422: el Backend IA no pudo descargar o decodificar la imagen
    console.error(
      `[matching] respuesta inconclusa del Backend IA para report ${reportId} (status ${response.status}); queda en pending para revisión manual`
    );
  }
}

// URL del bucket R2 a mandar al Backend IA; null si no corresponde llamarlo
function embeddingImageUrl(reportId: number, imageUrl: string): string | null {
  // filas previas a #229 pueden tener una URL externa: no se le manda a la IA
  const r2ImageUrl = normalizeR2PublicUrl(imageUrl);
  if (!r2ImageUrl) {
    console.warn(`[matching] report ${reportId} tiene una imagen fuera del bucket R2; no se envía al Backend IA y queda sin cambios`);
  }
  return r2ImageUrl;
}

// Pipeline en proceso (sin REDIS_URL): reintentos en memoria y nunca rechaza.
// Sin timeout: es trabajo de fondo, el Backend IA acota su propia descarga y el
// veredicto es idempotente si la reconciliación lo vuelve a disparar.
export function triggerEmbeddingGeneration(reportId: number, imageUrl: string): Promise<void> {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) return Promise.resolve();

  const r2ImageUrl = embeddingImageUrl(reportId, imageUrl);
  if (!r2ImageUrl) return Promise.resolve();

  return fetchWithRetry(`${baseUrl}/images/embedding`, requestImageEmbedding(r2ImageUrl))
    .then((response) => handleEmbeddingResponse(reportId, imageUrl, response))
    .catch((error) => {
      console.error(
        `[matching] fallo al generar embedding para report ${reportId} tras ${RETRY_DELAYS_MS.length + 1} intentos; queda en pending para revisión manual:`,
        error
      );
    });
}

// Pipeline del worker de la cola (#177): un solo intento; rechaza ante una
// falla de red o un 5xx para que BullMQ reintente con backoff.
export async function processReportPipeline(reportId: number, imageUrl: string): Promise<void> {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) return;

  const r2ImageUrl = embeddingImageUrl(reportId, imageUrl);
  if (!r2ImageUrl) return;

  const response = await fetch(`${baseUrl}/images/embedding`, requestImageEmbedding(r2ImageUrl));
  if (response.status >= 500) {
    throw new Error(`Backend IA respondió ${response.status} para report ${reportId}`);
  }
  await handleEmbeddingResponse(reportId, imageUrl, response);
}

export type ReembedOutcome = "saved" | "no_animal" | "failed";

// Regenera el embedding de un reporte existente (cambio de modelo): no toca su
// estado ni busca matches, eso queda para una segunda pasada (reembed-reports).
export async function regenerateReportEmbedding(reportId: number, imageUrl: string): Promise<ReembedOutcome> {
  const baseUrl = process.env.AI_SERVICE_URL;
  const r2ImageUrl = normalizeR2PublicUrl(imageUrl);
  if (!baseUrl || !r2ImageUrl) return "failed";

  const response = await fetchWithRetry(`${baseUrl}/images/embedding`, requestImageEmbedding(r2ImageUrl));
  if (response.status !== 200) {
    console.error(`[matching] re-embedding inconcluso para report ${reportId} (status ${response.status})`);
    return "failed";
  }
  const result = parseImageEmbedding(await response.json());
  if (!result) return "failed";
  if (!result.hasAnimal) return "no_animal";
  return (await reportMatchingService.saveReportEmbedding(reportId, imageUrl, result.embedding)) ? "saved" : "failed";
}

// "animal_low_quality": blurry or moved photo (#212), only a warning for the user.
export type ImageAnalysisResult = "animal" | "animal_low_quality" | "no_animal" | "unavailable";

// Short and without retries: the user is waiting on this answer (upload screening
// and report creation). If the AI service is slow or down, the caller falls back
// to the async moderation pipeline instead of blocking.
const ANALYZE_TIMEOUT_MS = 15_000;

/**
 * Synchronously asks the AI service whether an image contains any animal, so
 * obvious spam (no animal at all) is rejected before a report is created.
 *
 * Only a well-formed 200 is a verdict. Anything else (AI service not
 * configured, network error, timeout, non-2xx, malformed body) is
 * "unavailable": callers must not block the user on it.
 */
export async function analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) return "unavailable";

  try {
    const response = await fetch(`${baseUrl}/images/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
      },
      body: JSON.stringify({ image_url: imageUrl }),
      signal: AbortSignal.timeout(ANALYZE_TIMEOUT_MS),
    });
    if (response.status !== 200) {
      console.error(`[matching] image analysis inconclusive (status ${response.status}) for ${imageUrl}`);
      return "unavailable";
    }
    const body = (await response.json()) as { has_animal?: unknown; low_quality?: unknown };
    if (typeof body.has_animal !== "boolean") {
      console.error(`[matching] image analysis returned a malformed body for ${imageUrl}`);
      return "unavailable";
    }
    if (!body.has_animal) return "no_animal";
    // missing or non-boolean low_quality (AI service without #212): no warning
    return body.low_quality === true ? "animal_low_quality" : "animal";
  } catch (error) {
    console.error(`[matching] image analysis failed for ${imageUrl}:`, error);
    return "unavailable";
  }
}

// dimensión de DINOv2 ViT-B/14, igual que report_embeddings
const EMBEDDING_DIMENSIONS = 768;
// Más corto que el análisis: las sugerencias son opcionales y sin respuesta se ordena por cercanía.
// Cubre la inferencia (≈0,68 s, ADR-0005) más la descarga desde R2.
export const EMBED_TIMEOUT_MS = 5_000;

// Body of 200 /images/embedding: no pet -> has_animal false; null if malformed.
type ImageEmbedding = { hasAnimal: true; embedding: number[] } | { hasAnimal: false };

function parseImageEmbedding(body: unknown): ImageEmbedding | null {
  const { has_animal: hasAnimal, embedding } = (body ?? {}) as { has_animal?: unknown; embedding?: unknown };
  if (hasAnimal === false) return { hasAnimal: false };
  if (
    hasAnimal !== true ||
    !Array.isArray(embedding) ||
    embedding.length !== EMBEDDING_DIMENSIONS ||
    !embedding.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    return null;
  }
  return { hasAnimal: true, embedding: embedding as number[] };
}

function requestImageEmbedding(imageUrl: string, signal?: AbortSignal): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
    },
    body: JSON.stringify({ image_url: imageUrl }),
    ...(signal ? { signal } : {}),
  };
}

/**
 * Embedding of an uploaded image that has no report yet (#211). Never throws:
 * null means "rank without image similarity" (also when there is no pet).
 */
export async function embedImage(imageUrl: string): Promise<number[] | null> {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) return null;

  try {
    const response = await fetch(
      `${baseUrl}/images/embedding`,
      requestImageEmbedding(imageUrl, AbortSignal.timeout(EMBED_TIMEOUT_MS))
    );
    if (response.status !== 200) {
      console.error(`[matching] image embedding inconclusive (status ${response.status}) for ${imageUrl}`);
      return null;
    }
    const result = parseImageEmbedding(await response.json());
    if (!result) {
      console.error(`[matching] image embedding returned a malformed body for ${imageUrl}`);
      return null;
    }
    return result.hasAnimal ? result.embedding : null;
  } catch (error) {
    console.error(`[matching] image embedding failed for ${imageUrl}:`, error);
    return null;
  }
}

/**
 * Sin cola, los reintentos de `triggerEmbeddingGeneration` viven en memoria y
 * se agotan en ~36s; con cola, los de BullMQ también se agotan. Si el Backend
 * IA estuvo caído más que eso —o si el proceso de Node se reinició con la
 * llamada en vuelo— el reporte queda en "pending" y nadie volvería a mirarlo: no se publica, no genera embedding y no puede
 * matchear. Esta reconciliación periódica es la red de contención para eso.
 *
 * La ventana se mide desde `updatedAt`, no desde `createdAt`: un reporte entra
 * en "pending" al crearse, pero también vuelve a "pending" cuando el dueño le
 * cambia la foto, y en ese caso su `createdAt` puede ser de hace días.
 *
 * `RECONCILE_GRACE_MS` es más largo que el presupuesto de reintentos para no
 * pisar una generación que todavía está en curso, y `RECONCILE_MAX_AGE_MS`
 * acota la ventana: un reporte que sigue pending un día después de haber
 * entrado (o vuelto) a ese estado tiene un
 * problema que reintentar no arregla (imagen borrada del storage, URL rota),
 * así que se deja de insistir y queda para revisión manual en vez de generar
 * un reintento infinito cada pasada.
 */
const RECONCILE_GRACE_MS = 2 * 60 * 1000;
const RECONCILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
// Cota por pasada: el Backend IA procesa la inferencia de forma síncrona, así
// que disparar toda la cola de una encolaría requests que expiran esperando.
const RECONCILE_BATCH_SIZE = 10;

// encola en Redis o, sin cola, dispara el pipeline en proceso
export type ReportPipelineDispatch = (reportId: number, imageUrl: string) => Promise<void>;

/**
 * Vuelve a disparar la generación de embedding para los reportes atascados en
 * "pending". Devuelve cuántos se reencolaron.
 */
export async function reconcilePendingReports(
  dispatch: ReportPipelineDispatch = triggerEmbeddingGeneration
): Promise<number> {
  if (!process.env.AI_SERVICE_URL) return 0;

  const now = Date.now();
  const stuck = await prisma.report.findMany({
    where: {
      status: "pending",
      imageUrl: { not: null },
      updatedAt: {
        lt: new Date(now - RECONCILE_GRACE_MS),
        gt: new Date(now - RECONCILE_MAX_AGE_MS),
      },
    },
    select: { id: true, imageUrl: true },
    orderBy: { updatedAt: "asc" },
    take: RECONCILE_BATCH_SIZE,
  });

  for (const report of stuck) {
    // imageUrl no puede ser null acá por el filtro de la query, pero Prisma no
    // estrecha el tipo a partir de un `not: null` en el where.
    dispatch(report.id, report.imageUrl as string).catch((error) => {
      console.error(`[matching] no se pudo reencolar el report ${report.id}:`, error);
    });
  }

  if (stuck.length > 0) {
    console.log(`[matching] reencolados ${stuck.length} reporte(s) atascados en pending`);
  }
  return stuck.length;
}

/**
 * Arranca la reconciliación periódica. Se llama una vez al levantar el server
 * (ver src/index.ts). El timer es `unref`ado para que no mantenga vivo el
 * proceso por sí solo (importante para los tests y para un shutdown limpio).
 */
export function startPendingReportsReconciliation(
  dispatch: ReportPipelineDispatch = triggerEmbeddingGeneration
): NodeJS.Timeout {
  const run = () => {
    reconcilePendingReports(dispatch).catch((error) => {
      console.error("[matching] fallo la reconciliación de reportes pending:", error);
    });
  };

  run();
  const timer = setInterval(run, RECONCILE_INTERVAL_MS);
  timer.unref();
  return timer;
}

export interface MatchDTO {
  matchId: number;
  reportId: number;
  title: string;
  imageUrl: string | null;
  reportType: string;
  similarityScore: number | null;
  status: string;
  createdAt: Date;
}

/**
 * Lista los matches sugeridos (generados por findAndStoreMatches, ver
 * report-matching.service.ts) donde `reportId` participa, sea como lost o found.
 * Devuelve los datos básicos del OTRO reporte de cada match, ordenados por
 * similaridad descendente. Los descartados no se sugieren más a ninguna parte.
 */
export async function listMatches(reportId: number): Promise<MatchDTO[]> {
  return prisma.$queryRaw<MatchDTO[]>`
    SELECT
      rm.id AS "matchId",
      CASE WHEN rm.report_lost_id = ${reportId} THEN rm.report_found_id ELSE rm.report_lost_id END AS "reportId",
      other.title,
      other.image_url AS "imageUrl",
      other.report_type AS "reportType",
      rm.similarity_score AS "similarityScore",
      rm.status,
      rm.created_at AS "createdAt"
    FROM report_matches rm
    JOIN reports other
      ON other.id = CASE WHEN rm.report_lost_id = ${reportId} THEN rm.report_found_id ELSE rm.report_lost_id END
    WHERE (rm.report_lost_id = ${reportId} OR rm.report_found_id = ${reportId})
      AND rm.status <> 'rejected'::match_status
      AND other.status IN ('published'::report_status, 'resolved'::report_status)
      AND ${visibleAuthorSql(Prisma.sql`other.user_id`)}
      AND EXISTS (SELECT 1 FROM reports src WHERE src.id = ${reportId} AND ${visibleAuthorSql(Prisma.sql`src.user_id`)})
    ORDER BY rm.similarity_score DESC
  `;
}

export interface MatchDecisionDTO {
  matchId: number;
  status: MatchStatus;
  confirmedAt: Date | null;
}

type MatchDecision = Exclude<MatchStatus, "pending">;

async function decideMatch(
  reportId: number,
  matchId: number,
  userId: number,
  decision: MatchDecision
): Promise<MatchDecisionDTO> {
  const report = await prisma.report.findUnique({ where: { id: reportId }, select: { userId: true, status: true } });
  if (!report) {
    throw new AppError(404, "Reporte no encontrado");
  }
  if (report.userId !== userId) {
    throw new AppError(403, "No tenés permiso para gestionar las coincidencias de este reporte");
  }
  // confirmar avisa a la otra parte: solo con el reporte propio público (#311)
  if (decision === "confirmed" && report.status !== "published" && report.status !== "resolved") {
    throw new AppError(409, "Solo se pueden confirmar coincidencias de reportes publicados");
  }

  const match = await prisma.reportMatch.findUnique({
    where: { id: matchId },
    select: { reportLostId: true, reportFoundId: true },
  });
  if (!match || (match.reportLostId !== reportId && match.reportFoundId !== reportId)) {
    throw new AppError(404, "Coincidencia no encontrada");
  }

  // Escritura condicional: si dos decisiones compiten, solo la primera pasa.
  const confirmedAt = decision === "confirmed" ? new Date() : null;
  const { count } = await prisma.reportMatch.updateMany({
    where: { id: matchId, status: "pending" },
    data: { status: decision, confirmedAt },
  });
  if (count === 0) {
    const current = await prisma.reportMatch.findUnique({ where: { id: matchId }, select: { status: true } });
    throw new AppError(
      409,
      current?.status === "confirmed" ? "La coincidencia ya fue confirmada" : "La coincidencia ya fue rechazada"
    );
  }

  if (decision === "confirmed") {
    await touchDecidingReport(reportId);
    await notifyOtherParty(match, reportId, userId);
  }

  return { matchId, status: decision, confirmedAt };
}

// confirmar cuenta como actividad solo del reporte de quien confirma (#264); un fallo no deshace la decisión
async function touchDecidingReport(reportId: number): Promise<void> {
  try {
    await touchActivity([reportId]);
  } catch (error) {
    console.error(`[matching] no se pudo registrar la actividad del report ${reportId}:`, error);
  }
}

// avisa al autor del otro reporte; un fallo no deshace la decisión
async function notifyOtherParty(
  match: { reportLostId: number; reportFoundId: number },
  reportId: number,
  deciderId: number
): Promise<void> {
  const otherReportId = match.reportLostId === reportId ? match.reportFoundId : match.reportLostId;
  try {
    const other = await prisma.report.findUnique({ where: { id: otherReportId }, select: { userId: true } });
    if (!other || other.userId === deciderId) return;
    await notificationsService.notifyMatchConfirmed({ recipientId: other.userId, reportId });
  } catch (error) {
    console.error(`[matching] no se pudo avisar la confirmación del match del report ${reportId}:`, error);
  }
}

export function confirmMatch(reportId: number, matchId: number, userId: number): Promise<MatchDecisionDTO> {
  return decideMatch(reportId, matchId, userId, "confirmed");
}

export function rejectMatch(reportId: number, matchId: number, userId: number): Promise<MatchDecisionDTO> {
  return decideMatch(reportId, matchId, userId, "rejected");
}
