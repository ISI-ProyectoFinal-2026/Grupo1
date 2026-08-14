import { prisma } from "../db/client";

/**
 * Dispara la generación de embedding en el Backend IA para un reporte
 * recién creado. Fire-and-forget: no se espera la inferencia de ML, la
 * creación del reporte nunca queda bloqueada ni falla por esto.
 *
 * Nota: el body usa `image_url` (snake_case) porque así lo espera el
 * endpoint `POST /reports/{report_id}/embedding` del Backend IA
 * (Pydantic model `EmbeddingRequest.image_url`, ver backend-ia/app/main.py).
 */
export function triggerEmbeddingGeneration(reportId: number, imageUrl: string): void {
  const baseUrl = process.env.AI_SERVICE_URL;
  if (!baseUrl) return;

  fetch(`${baseUrl}/reports/${reportId}/embedding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl }),
  }).catch((error) => {
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
