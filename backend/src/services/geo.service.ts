import { prisma } from "../db/client";
import { reportColumns, toReportDTO, ReportDTO, ReportRow } from "./reports.service";
import { BoundingBox } from "../validators/geo.validator";

/**
 * Reportes publicados dentro de `radiusKm` de (lat, lng). Usa ST_DWithin
 * con cast a geography (igual que matching_service.py) porque `location`
 * es geometry en grados WGS84: sin el cast, el radio se interpretaría en
 * grados en vez de metros.
 */
export async function nearby(lat: number, lng: number, radiusKm: number): Promise<ReportDTO[]> {
  const radiusMeters = radiusKm * 1000;
  const rows = await prisma.$queryRaw<ReportRow[]>`
    SELECT ${reportColumns}
    FROM reports r
    LEFT JOIN pets p ON p.id = r.pet_id
    WHERE r.status = 'published'::report_status
      AND ST_DWithin(r.location::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusMeters})
    ORDER BY r.created_at DESC
  `;
  return rows.map(toReportDTO);
}

/** Reportes publicados dentro del bounding box del mapa (viewport). */
export async function withinBounds(bounds: BoundingBox): Promise<ReportDTO[]> {
  const rows = await prisma.$queryRaw<ReportRow[]>`
    SELECT ${reportColumns}
    FROM reports r
    LEFT JOIN pets p ON p.id = r.pet_id
    WHERE r.status = 'published'::report_status
      AND ST_Within(r.location::geometry, ST_MakeEnvelope(${bounds.swLng}, ${bounds.swLat}, ${bounds.neLng}, ${bounds.neLat}, 4326))
    ORDER BY r.created_at DESC
  `;
  return rows.map(toReportDTO);
}
