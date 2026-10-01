import { Prisma, ReportType, ReportStatus } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { NO_ANIMAL_DETECTED_MESSAGE } from "../constants/moderation";
import * as matchingService from "./matching.service";
import { isR2PublicUrl } from "./storage.service";
import { CreateReportInput, UpdateReportInput, ListReportsQuery } from "../validators/reports.validator";

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export interface ReportRow {
  id: number;
  userId: number;
  petId: number | null;
  reportType: ReportType;
  status: ReportStatus;
  title: string;
  description: string | null;
  imageUrl: string | null;
  customFlyerUrl: string | null;
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

export function toReportDTO(row: ReportRow): ReportDTO {
  const { lat, lng, ...rest } = row;
  return {
    ...rest,
    location: lat !== null && lng !== null ? { lat, lng } : null,
    tag: toReportTag(row.reportType, row.status),
  };
}

export const reportColumns = Prisma.sql`
  r.id, r.user_id AS "userId", r.pet_id AS "petId", r.report_type AS "reportType",
  r.status, r.title, r.description, r.image_url AS "imageUrl",
  r.custom_flyer_url AS "customFlyerUrl",
  r.location_address AS "locationAddress",
  ST_Y(r.location::geometry) AS lat, ST_X(r.location::geometry) AS lng,
  r.created_at AS "createdAt", r.updated_at AS "updatedAt", r.published_at AS "publishedAt"
`;

export async function list(filters: ListReportsQuery = {}, viewerId?: number): Promise<ReportDTO[]> {
  // pending/rejected son estados de moderacion: solo el dueño puede listar
  // los propios, un anonimo o un tercero no debe poder scrapearlos pidiendo
  // el status explicito (ver issue #180).
  const isPrivateStatus = filters.status === "pending" || filters.status === "rejected";
  if (isPrivateStatus && viewerId === undefined) {
    return [];
  }

  const conditions: Prisma.Sql[] = [];
  if (filters.type) conditions.push(Prisma.sql`r.report_type = ${filters.type}::report_type`);
  conditions.push(
    filters.status
      ? Prisma.sql`r.status = ${filters.status}::report_status`
      : Prisma.sql`r.status = 'published'::report_status`
  );
  if (isPrivateStatus) conditions.push(Prisma.sql`r.user_id = ${viewerId}`);
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

export async function getVisibleById(id: number, viewerId?: number): Promise<ReportDTO> {
  const report = await getById(id);
  const isPublicStatus = report.status === "published" || report.status === "resolved";
  if (isPublicStatus || report.userId === viewerId) {
    return report;
  }
  // 404 y no 403: no confirmarle a quien no es el dueño que el reporte existe.
  throw new AppError(404, "Reporte no encontrado");
}

/**
 * Upfront screening: an image with no animal at all is rejected before anything
 * is persisted. The frontend runs the same check right after the upload, but it
 * is enforced here so the API cannot be used to bypass it. If the AI service
 * cannot answer, the report is still saved as "pending" and the async
 * moderation pipeline (triggerEmbeddingGeneration + reconciliation) decides.
 * Only images in our R2 bucket are screened synchronously: answering for an
 * arbitrary URL would turn this endpoint into an SSRF oracle.
 */
async function assertImageHasAnimal(imageUrl: string): Promise<void> {
  if (isR2PublicUrl(imageUrl) && (await matchingService.analyzeImage(imageUrl)) === "no_animal") {
    throw new AppError(422, NO_ANIMAL_DETECTED_MESSAGE);
  }
}

// Fire-and-forget: no se espera la inferencia de ML. Se envuelve en try/catch
// además del .catch() interno del servicio para que ni siquiera un error
// síncrono al disparar la llamada haga fallar la operación sobre el reporte.
function triggerModeration(reportId: number, imageUrl: string): void {
  try {
    matchingService.triggerEmbeddingGeneration(reportId, imageUrl);
  } catch (error) {
    console.error(`[matching] fallo al disparar la generación de embedding para report ${reportId}:`, error);
  }
}

export async function create(data: CreateReportInput & { userId: number }): Promise<ReportDTO> {
  if (data.imageUrl) {
    await assertImageHasAnimal(data.imageUrl);
  }

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
          // Solo se sella la fecha si el reporte nace publicado. Si queda en
          // "pending", lo publica (y sella la fecha) matching.service al recibir
          // el veredicto del Backend IA.
          publishedAt: data.imageUrl ? null : new Date(),
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
    triggerModeration(report.id, report.imageUrl);
  }
  return report;
}

export async function update(id: number, userId: number, data: UpdateReportInput): Promise<ReportDTO> {
  const existing = await getById(id);
  if (existing.userId !== userId) {
    throw new AppError(403, "No tenés permiso para modificar este reporte");
  }

  const { location, ...scalarData } = data;

  // A new photo goes through the same moderation as on create(): otherwise a
  // report published with a dog photo could be edited to show anything. The
  // report is hidden again ("pending") until the async pipeline approves it.
  const newImageUrl = data.imageUrl !== undefined && data.imageUrl !== existing.imageUrl ? data.imageUrl : null;
  if (newImageUrl) {
    // Re-moderating a closed report would publish it again, and "resolved"
    // sent along with the new photo would be overwritten by "pending".
    if (existing.status === "resolved" || data.status === "resolved") {
      throw new AppError(409, "No se puede cambiar la foto de un reporte resuelto");
    }
    await assertImageHasAnimal(newImageUrl);
  }
  const updateData = newImageUrl ? { ...scalarData, status: "pending" as const, publishedAt: null } : scalarData;

  await prisma.$transaction(async (tx) => {
    try {
      await tx.report.update({ where: { id }, data: updateData });
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

  if (newImageUrl) {
    triggerModeration(id, newImageUrl);
  }
  return getById(id);
}

export async function close(id: number, userId: number): Promise<ReportDTO> {
  const report = await getById(id);
  if (report.userId !== userId) {
    throw new AppError(403, "No tenés permiso para cerrar este reporte");
  }
  if (report.status === "resolved") {
    throw new AppError(409, "El reporte ya está resuelto");
  }
  await prisma.report.update({ where: { id }, data: { status: "resolved" } });
  return getById(id);
}

export async function setCustomFlyer(id: number, userId: number, flyerUrl: string): Promise<ReportDTO> {
  const report = await getById(id);
  if (report.userId !== userId) {
    throw new AppError(403, "No tenés permiso para modificar el flyer de este reporte");
  }
  await prisma.report.update({ where: { id }, data: { customFlyerUrl: flyerUrl } });
  return getById(id);
}

export async function remove(id: number, userId: number): Promise<void> {
  const report = await getById(id);
  if (report.userId !== userId) {
    throw new AppError(403, "No tenés permiso para eliminar este reporte");
  }

  try {
    await prisma.report.delete({ where: { id } });
  } catch (error) {
    if (isPrismaKnownError(error, "P2025")) {
      throw new AppError(404, "Reporte no encontrado");
    }
    throw error;
  }
}
