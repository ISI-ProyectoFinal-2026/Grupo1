import { Prisma, ReportType, ReportStatus } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import * as matchingService from "./matching.service";
import { CreateReportInput, UpdateReportInput, ListReportsQuery } from "../validators/reports.validator";

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

interface ReportRow {
  id: number;
  userId: number;
  petId: number | null;
  reportType: ReportType;
  status: ReportStatus;
  title: string;
  description: string | null;
  imageUrl: string | null;
  locationAddress: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

export type ReportTagLabel = "PERDIDO" | "ENCONTRADO" | "RESUELTO";

export interface ReportTag {
  label: ReportTagLabel;
  color: string;
}

const REPORT_TAG_COLORS: Record<ReportTagLabel, string> = {
  PERDIDO: "#EF4444",
  ENCONTRADO: "#3B82F6",
  RESUELTO: "#22C55E",
};

function toReportTag(reportType: ReportType, status: ReportStatus): ReportTag {
  const label: ReportTagLabel = status === "resolved" ? "RESUELTO" : reportType === "lost" ? "PERDIDO" : "ENCONTRADO";
  return { label, color: REPORT_TAG_COLORS[label] };
}

export interface ReportDTO extends Omit<ReportRow, "lat" | "lng"> {
  location: { lat: number; lng: number } | null;
  tag: ReportTag;
}

function toReportDTO(row: ReportRow): ReportDTO {
  const { lat, lng, ...rest } = row;
  return {
    ...rest,
    location: lat !== null && lng !== null ? { lat, lng } : null,
    tag: toReportTag(row.reportType, row.status),
  };
}

const reportColumns = Prisma.sql`
  r.id, r.user_id AS "userId", r.pet_id AS "petId", r.report_type AS "reportType",
  r.status, r.title, r.description, r.image_url AS "imageUrl",
  r.location_address AS "locationAddress",
  ST_Y(r.location::geometry) AS lat, ST_X(r.location::geometry) AS lng,
  r.created_at AS "createdAt", r.updated_at AS "updatedAt", r.published_at AS "publishedAt"
`;

export async function list(filters: ListReportsQuery = {}): Promise<ReportDTO[]> {
  const conditions: Prisma.Sql[] = [];
  if (filters.type) conditions.push(Prisma.sql`r.report_type = ${filters.type}::report_type`);
  conditions.push(
    filters.status
      ? Prisma.sql`r.status = ${filters.status}::report_status`
      : Prisma.sql`r.status = 'published'::report_status`
  );
  if (filters.breed) conditions.push(Prisma.sql`p.breed ILIKE ${`%${filters.breed}%`}`);
  if (filters.zone) conditions.push(Prisma.sql`r.location_address ILIKE ${`%${filters.zone}%`}`);
  if (filters.dateFrom) conditions.push(Prisma.sql`r.created_at >= ${filters.dateFrom}`);
  if (filters.dateTo) conditions.push(Prisma.sql`r.created_at <= ${filters.dateTo}`);
  const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
  const order = filters.order === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  const rows = await prisma.$queryRaw<ReportRow[]>`
    SELECT ${reportColumns} FROM reports r LEFT JOIN pets p ON p.id = r.pet_id ${where} ORDER BY r.created_at ${order}
  `;
  return rows.map(toReportDTO);
}

export async function getById(id: number): Promise<ReportDTO> {
  const rows = await prisma.$queryRaw<ReportRow[]>`
    SELECT ${reportColumns} FROM reports r WHERE r.id = ${id}
  `;
  if (!rows[0]) {
    throw new AppError(404, "Reporte no encontrado");
  }
  return toReportDTO(rows[0]);
}

export async function create(data: CreateReportInput): Promise<ReportDTO> {
  const reportId = await prisma.$transaction(async (tx) => {
    let created;
    try {
      created = await tx.report.create({
        data: {
          userId: data.userId,
          petId: data.petId ?? null,
          reportType: data.reportType,
          // POC de moderación de contenido (issue #19): si hay imagen,
          // el reporte queda "pending" hasta que el Backend IA confirme
          // (vía triggerEmbeddingGeneration) que detectó una mascota.
          // Sin imagen no hay nada que validar, se publica directo.
          status: data.imageUrl ? "pending" : "published",
          title: data.title,
          description: data.description ?? null,
          imageUrl: data.imageUrl ?? null,
          locationAddress: data.locationAddress ?? null,
          publishedAt: new Date(),
        },
      });
    } catch (error) {
      if (isPrismaKnownError(error, "P2003")) {
        throw new AppError(400, "userId o petId no corresponde a un registro existente");
      }
      throw error;
    }
    await tx.$executeRaw`
      UPDATE reports
      SET location = ST_SetSRID(ST_MakePoint(${data.location.lng}, ${data.location.lat}), 4326)
      WHERE id = ${created.id}
    `;
    return created.id;
  });

  const report = await getById(reportId);
  if (report.imageUrl) {
    // Fire-and-forget: no se espera la inferencia de ML. Se envuelve en
    // try/catch además del .catch() interno del servicio para que ni
    // siquiera un error síncrono al disparar la llamada haga fallar la
    // creación del reporte.
    try {
      matchingService.triggerEmbeddingGeneration(report.id, report.imageUrl);
    } catch (error) {
      console.error(`[matching] fallo al disparar la generación de embedding para report ${report.id}:`, error);
    }
  }
  return report;
}

export async function update(id: number, data: UpdateReportInput): Promise<ReportDTO> {
  const { location, ...scalarData } = data;

  await prisma.$transaction(async (tx) => {
    try {
      await tx.report.update({ where: { id }, data: scalarData });
    } catch (error) {
      if (isPrismaKnownError(error, "P2025")) {
        throw new AppError(404, "Reporte no encontrado");
      }
      if (isPrismaKnownError(error, "P2003")) {
        throw new AppError(400, "petId no corresponde a una mascota existente");
      }
      throw error;
    }
    if (location) {
      await tx.$executeRaw`
        UPDATE reports
        SET location = ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)
        WHERE id = ${id}
      `;
    }
  });

  return getById(id);
}

export async function remove(id: number): Promise<void> {
  try {
    await prisma.report.delete({ where: { id } });
  } catch (error) {
    if (isPrismaKnownError(error, "P2025")) {
      throw new AppError(404, "Reporte no encontrado");
    }
    throw error;
  }
}
