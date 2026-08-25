import { prisma } from "../db/client";

/**
 * Dispara la generación de embedding en el Backend IA para un reporte
 * recién creado. Fire-and-forget: no se espera la inferencia de ML, la
 * creación del reporte nunca queda bloqueada ni falla por esto.
 *
 * Nota: el body usa `image_url` (snake_case) porque así lo espera el
 * endpoint `POST /reports/{report_id}/embedding` del Backend IA
 * (Pydantic model `EmbeddingRequest.image_url`, ver backend-ia/app/main.py).
 *
 * Moderación de contenido (POC, issue #19): el Backend IA responde 201
 * cuando detectó una mascota y generó el embedding, y 422 cuando no
 * detectó ninguna mascota en la imagen (contenido irrelevante). Solo
 * esos dos códigos son un veredicto de moderación y resuelven el reporte
 * fuera de "pending": 201 -> published, 422 -> rejected.
 *
 * Cualquier otro resultado (otro status HTTP, o el fetch rechazando por
 * falla de red) es INCONCLUSO: se loguea y el reporte queda "pending"
 * para revisión manual, sin lanzar ni generar un unhandled rejection.
 * Rechazar ante una caída del Backend IA descartaría reportes legítimos
 * de forma permanente y silenciosa (issue #125).
 *
 * La actualización se hace acá con Prisma directo (no llamando de vuelta
 * a reports.service.ts) porque reports.service.ts ya importa este módulo;
 * llamar en sentido inverso crearía una dependencia circular. Este archivo
 * ya lee `reports` directamente vía SQL crudo en listMatches, así que una
 * escritura directa con Prisma acá es consistente con el layering existente.
 */
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

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status < 500) {
        return response;
      }
      lastResponse = response;
    } catch (err) {
      lastError = err;
    }
    if (attempt < RETRY_DELAYS_MS.length - 1) {
      await new Promise((res) => setTimeout(res, RETRY_DELAYS_MS[attempt]));
    }
  }

  if (lastResponse) {
    return lastResponse;
  }
  throw lastError;
}

export function triggerEmbeddingGeneration(reportId: number, imageUrl: string): void {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) return;

  fetchWithRetry(`${baseUrl}/reports/${reportId}/embedding`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": process.env.INTERNAL_API_KEY ?? "",
    },
    body: JSON.stringify({ image_url: imageUrl }),
  })
    .then(async (response) => {
      if (response.status === 201) {
        // publishedAt se sella acá y no en la creación, porque hasta este
        // momento el reporte nunca estuvo publicado.
        await prisma.report.update({
          where: { id: reportId },
          data: { status: "published", publishedAt: new Date() },
        });
      } else if (response.status === 422) {
        await prisma.report.update({ where: { id: reportId }, data: { status: "rejected" } });
      } else {
        console.error(
          `[matching] respuesta inconclusa del Backend IA para report ${reportId} (status ${response.status}); queda en pending para revisión manual`
        );
      }
    })
    .catch((error) => {
      console.error(
        `[matching] fallo al generar embedding para report ${reportId} tras ${RETRY_DELAYS_MS.length} intentos; queda en pending para revisión manual:`,
        error
      );
    });
}

export interface MatchDTO {
  reportId: number;
  title: string;
  imageUrl: string | null;
  reportType: string;
  similarityScore: number | null;
  status: string;
  createdAt: Date;
}

/**
 * Lista los matches sugeridos (generados por el Backend IA, ver
 * matching_service.py) donde `reportId` participa, sea como lost o found.
 * Devuelve los datos básicos del OTRO reporte de cada match, ordenados por
 * similaridad descendente.
 */
export async function listMatches(reportId: number): Promise<MatchDTO[]> {
  return prisma.$queryRaw<MatchDTO[]>`
    SELECT
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
    WHERE rm.report_lost_id = ${reportId} OR rm.report_found_id = ${reportId}
    ORDER BY rm.similarity_score DESC
  `;
}
