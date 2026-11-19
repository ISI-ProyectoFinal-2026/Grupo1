import { Prisma } from "@prisma/client";
import { getMatchingConfig } from "../config/matching";
import { prisma } from "../db/client";
import { activeAuthorSql } from "./account-sanctions/active";
import { sanctionClock } from "./account-sanctions/clock";
import * as notificationsService from "./notifications.service";

// Persistencia de embeddings y búsqueda de matches por similitud (ADR-0029).
// SQL crudo: Prisma no modela `vector` ni `geography`.

const toVectorLiteral = (embedding: number[]) => `[${embedding.join(",")}]`;

// Upsert del embedding solo si el reporte sigue mostrando la imagen analizada.
export async function saveReportEmbedding(reportId: number, imageUrl: string, embedding: number[]): Promise<boolean> {
  const count = await prisma.$executeRaw`
    INSERT INTO report_embeddings (report_id, embedding, created_at)
    SELECT r.id, ${toVectorLiteral(embedding)}::vector, now()
    FROM reports r
    WHERE r.id = ${reportId} AND r.image_url = ${imageUrl}
    ON CONFLICT (report_id) DO UPDATE SET embedding = EXCLUDED.embedding
  `;
  return count > 0;
}

interface MatchSource {
  reportType: "lost" | "found";
  location: string | null;
  embedding: string;
}

interface MatchCandidate {
  id: number;
  similarity: number;
}

/**
 * Busca candidatos (tipo opuesto, publicados, cerca y recientes) para un
 * reporte con embedding y persiste en report_matches los que superan
 * matchThreshold; los que superan notifyThreshold además notifican.
 * Devuelve la cantidad de matches creados o actualizados.
 */
export async function findAndStoreMatches(reportId: number): Promise<number> {
  const config = getMatchingConfig();
  const now = sanctionClock.now();

  const [source] = await prisma.$queryRaw<MatchSource[]>`
    SELECT r.report_type::text AS "reportType", r.location::text AS location, re.embedding::text AS embedding
    FROM reports r
    JOIN report_embeddings re ON re.report_id = r.id
    WHERE r.id = ${reportId}
      AND ${activeAuthorSql(Prisma.sql`r.user_id`, now)}
  `;
  if (!source) return 0;

  // `<=>` es distancia COSENO (la de la calibración y la del índice HNSW
  // vector_cosine_ops); `<->` es L2 y no da la similitud coseno.
  // ST_DWithin mide en metros solo con geography: `location` es geometry en grados.
  const candidates = await prisma.$queryRaw<MatchCandidate[]>`
    SELECT r.id, 1 - (re.embedding <=> ${source.embedding}::vector) AS similarity
    FROM reports r
    JOIN report_embeddings re ON re.report_id = r.id
    WHERE r.status = 'published'
      AND r.report_type != CAST(${source.reportType} AS report_type)
      AND r.id != ${reportId}
      AND ST_DWithin(r.location::geography, CAST(${source.location} AS geography), ${config.radiusMeters}::float8)
      AND r.created_at > NOW() - make_interval(days => ${config.windowDays}::int)
      AND ${activeAuthorSql(Prisma.sql`r.user_id`, now)}
    ORDER BY re.embedding <=> ${source.embedding}::vector ASC
    LIMIT ${config.topK}
  `;

  let matchesStored = 0;
  for (const candidate of candidates) {
    if (candidate.similarity < config.matchThreshold) continue;

    const [lostReportId, foundReportId] =
      source.reportType === "lost" ? [reportId, candidate.id] : [candidate.id, reportId];

    // no pisa un match ya confirmado o rechazado
    const upserted = await prisma.$queryRaw<{ id: number }[]>`
      INSERT INTO report_matches (report_lost_id, report_found_id, similarity_score, created_at)
      VALUES (${lostReportId}, ${foundReportId}, ${candidate.similarity}::float8, now())
      ON CONFLICT (report_lost_id, report_found_id)
      DO UPDATE SET similarity_score = EXCLUDED.similarity_score
      WHERE report_matches.status = 'pending'
      RETURNING id
    `;
    if (upserted.length === 0) continue;

    matchesStored++;
    if (candidate.similarity >= config.notifyThreshold) {
      await notifyMatch(lostReportId, foundReportId, candidate.similarity);
    }
  }
  return matchesStored;
}

// best-effort: un fallo al notificar no corta el matching
async function notifyMatch(lostReportId: number, foundReportId: number, similarityScore: number): Promise<void> {
  try {
    await notificationsService.notifyMatch({ lostReportId, foundReportId, similarityScore });
  } catch (error) {
    console.error(
      `[matching] no se pudo notificar el match (lost ${lostReportId}, found ${foundReportId}):`,
      error
    );
  }
}
