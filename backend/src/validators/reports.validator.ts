import { z } from "zod";
import { ReportType, ReportStatus } from "@prisma/client";
import { safeHttpUrlSchema } from "./shared.validator";

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const createReportSchema = z.object({
  petId: z.number().int().positive().optional(),
  reportType: z.enum([ReportType.lost, ReportType.found]),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  imageUrl: safeHttpUrlSchema.optional(),
  location: locationSchema,
  locationAddress: z.string().min(1).optional(),
});

/**
 * `status` acepta únicamente `resolved`.
 *
 * `pending`, `published` y `rejected` los administra el gate de moderación del
 * Backend IA (ver `reports.service.ts` -> `triggerEmbeddingGeneration`). Si el
 * autor pudiera enviarlos por acá, publicaría su propio reporte sin pasar por
 * la revisión: `update()` solo valida propiedad, nunca la transición de estado.
 * Cerrar el reporte sí es una acción legítima del autor, así que `resolved`
 * queda habilitado.
 */
export const updateReportSchema = createReportSchema
  .extend({ status: z.literal(ReportStatus.resolved).optional() })
  .partial();

export const reportIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listReportsQuerySchema = z.object({
  type: z.enum([ReportType.lost, ReportType.found]).optional(),
  status: z.enum([ReportStatus.pending, ReportStatus.published, ReportStatus.rejected, ReportStatus.resolved]).optional(),
  breed: z.string().min(1).optional(),
  zone: z.string().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export const setCustomFlyerSchema = z.object({
  flyerUrl: safeHttpUrlSchema,
});

export type SetCustomFlyerInput = z.infer<typeof setCustomFlyerSchema>;

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
