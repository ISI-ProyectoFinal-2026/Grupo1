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
 * detectó ninguna mascota en la imagen (contenido irrelevante). Usamos
 * ese código de estado para resolver el reporte fuera de "pending":
 * 201 -> published, 422 -> rejected. Cualquier otro resultado (otro
 * status HTTP, o el fetch rechazando por falla de red) es inconcluso,
 * no un veredicto de moderación: se loguea y el reporte queda "pending"
 * para revisión manual, sin lanzar ni generar un unhandled rejection.
 *
 * La actualización se hace acá con Prisma directo (no llamando de vuelta
 * a reports.service.ts) porque reports.service.ts ya importa este módulo;
 * llamar en sentido inverso crearía una dependencia circular. Este archivo
 * ya lee `reports` directamente vía SQL crudo en listMatches, así que una
 * escritura directa con Prisma acá es consistente con el layering existente.
 */
export function triggerEmbeddingGeneration(reportId: number, imageUrl: string): void {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) return;

  fetch(`${baseUrl}/reports/${reportId}/embedding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl }),
  })
    .then(async (response) => {
      if (response.status === 201) {
        await prisma.report.update({ where: { id: reportId }, data: { status: "published" } });
      } else if (response.status === 422) {
        await prisma.report.update({ where: { id: reportId }, data: { status: "rejected" } });
      }
    })
    .catch((error) => {
      console.error(`[matching] fallo al generar embedding para report ${reportId}:`, error);
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
