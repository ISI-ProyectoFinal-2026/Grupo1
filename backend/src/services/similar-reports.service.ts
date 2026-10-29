import { Prisma, ReportStatus, ReportType } from "@prisma/client";
import { prisma } from "../db/client";
import * as matchingService from "./matching.service";
import { SimilarReportsInput } from "../validators/reports.validator";

// criterios de #211
export const SIMILAR_RADIUS_METERS = 2_000;
export const SIMILAR_WINDOW_DAYS = 30;
export const SIMILAR_MAX_RESULTS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// sin datos de contacto del autor
export interface SimilarReportDTO {
  id: number;
  title: string;
  reportType: ReportType;
  status: ReportStatus;
  imageUrl: string | null;
  distanceMeters: number;
  similarity: number | null;
  isOwn: boolean;
}

/**
 * Posibles duplicados del reporte que se está creando: mismo tipo, cerca y
 * recientes. Con foto se ordena por similitud coseno (`<=>`, ver
 * matching_service.py); sin foto o si la IA no responde, por cercanía.
 */
export async function findSimilarReports(input: SimilarReportsInput, viewerId: number): Promise<SimilarReportDTO[]> {
  const embedding = input.imageUrl ? await matchingService.embedImage(input.imageUrl) : null;

  const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${input.location.lng}, ${input.location.lat}), 4326)::geography`;
  const similarity = embedding
    ? Prisma.sql`1 - (re.embedding <=> ${`[${embedding.join(",")}]`}::vector)`
    : Prisma.sql`NULL::float8`;
  const order = embedding ? Prisma.sql`similarity DESC NULLS LAST, "distanceMeters" ASC` : Prisma.sql`"distanceMeters" ASC`;
  const since = new Date(Date.now() - SIMILAR_WINDOW_DAYS * DAY_MS);

  const rows = await prisma.$queryRaw<SimilarReportDTO[]>`
    SELECT
      r.id, r.title, r.report_type AS "reportType", r.status, r.image_url AS "imageUrl",
      ST_Distance(r.location::geography, ${point}) AS "distanceMeters",
      ${similarity} AS similarity,
      r.user_id = ${viewerId} AS "isOwn"
    FROM reports r
    LEFT JOIN report_embeddings re ON re.report_id = r.id
    WHERE r.report_type = ${input.reportType}::report_type
      AND r.status IN ('published'::report_status, 'resolved'::report_status)
      AND r.created_at >= ${since}
      AND ST_DWithin(r.location::geography, ${point}, ${SIMILAR_RADIUS_METERS})
    ORDER BY ${order}
    LIMIT ${SIMILAR_MAX_RESULTS}
  `;
  return rows.map((row) => ({ ...row, distanceMeters: Math.round(row.distanceMeters) }));
}
