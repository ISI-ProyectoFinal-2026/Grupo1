import { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { visibleAuthorSql } from "./account-sanctions/visibility";
import { reportColumns, toReportDTO, ReportDTO, ReportRow } from "./reports.service";
import { BoundingBox, GEO_DEFAULT_LIMIT, GeoFilters } from "../validators/geo.validator";

type GeoFilterInput = Partial<GeoFilters>;

// mismos filtros que el feed (reports.service list) + tope de resultados
function filterConditions(filters: GeoFilterInput): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`r.status = 'published'::report_status`,
    visibleAuthorSql(Prisma.sql`r.user_id`),
  ];
  if (filters.type) conditions.push(Prisma.sql`r.report_type = ${filters.type}::report_type`);
  if (filters.zone) conditions.push(Prisma.sql`r.location_address ILIKE ${`%${filters.zone}%`}`);
  if (filters.dateFrom) conditions.push(Prisma.sql`r.created_at >= ${filters.dateFrom}`);
  if (filters.dateTo) conditions.push(Prisma.sql`r.created_at <= ${filters.dateTo}`);
  return conditions;
}

async function queryReports(spatial: Prisma.Sql, filters: GeoFilterInput): Promise<ReportDTO[]> {
  const where = Prisma.join([...filterConditions(filters), spatial], " AND ");
  const rows = await prisma.$queryRaw<ReportRow[]>`
    SELECT ${reportColumns}
    FROM reports r
    LEFT JOIN pets p ON p.id = r.pet_id
    WHERE ${where}
    ORDER BY r.created_at DESC
    LIMIT ${filters.limit ?? GEO_DEFAULT_LIMIT}
  `;
  return rows.map(toReportDTO);
}

/**
 * Reportes publicados dentro de `radiusKm` de (lat, lng). Usa ST_DWithin
 * con cast a geography (igual que matching_service.py) porque `location`
 * es geometry en grados WGS84: sin el cast, el radio se interpretaría en
 * grados en vez de metros.
 */
export function nearby(lat: number, lng: number, radiusKm: number, filters: GeoFilterInput = {}): Promise<ReportDTO[]> {
  const radiusMeters = radiusKm * 1000;
  return queryReports(
    Prisma.sql`ST_DWithin(r.location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})`,
    filters
  );
}

/** Reportes publicados dentro del bounding box del mapa (viewport). */
export function withinBounds(bounds: BoundingBox, filters: GeoFilterInput = {}): Promise<ReportDTO[]> {
  return queryReports(
    Prisma.sql`ST_Within(r.location::geometry, ST_MakeEnvelope(${bounds.swLng}, ${bounds.swLat}, ${bounds.neLng}, ${bounds.neLat}, 4326))`,
    filters
  );
}
