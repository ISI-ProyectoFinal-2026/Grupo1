import { z } from "zod";
import { ReportType, ReportStatus } from "@prisma/client";
import { locationSchema, r2ImageUrlSchema } from "./shared.validator";

// el "hoy" del suceso se mide en hora de Argentina, no en la del server
const EVENT_DATE_TIME_ZONE = "America/Argentina/Buenos_Aires";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayInArgentina(): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_DATE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// zod sigue con los refine aunque falle el regex: no asumir el formato
function isCalendarDate(value: string): boolean {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return ISO_DATE.test(value) && !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

// fecha del suceso (#259): día sin hora, se guarda como medianoche UTC
const eventDateSchema = z
  .string()
  .regex(ISO_DATE, "La fecha del suceso debe tener formato YYYY-MM-DD")
  .refine(isCalendarDate, "Fecha del suceso inválida")
  .refine((value) => value <= todayInArgentina(), "La fecha del suceso no puede ser futura")
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

// fotos extra además de la principal (4 en total)
export const MAX_REPORT_EXTRA_PHOTOS = 3;

const reportBaseSchema = z.object({
  petId: z.number().int().positive().optional(),
  reportType: z.enum([ReportType.lost, ReportType.found]),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  imageUrl: r2ImageUrlSchema,
  location: locationSchema,
  locationAddress: z.string().min(1).optional(),
  // teléfono del autor en el flyer público (#259)
  showPhoneOnFlyer: z.boolean().optional(),
  eventDate: eventDateSchema.optional(),
  extraImageUrls: z
    .array(r2ImageUrlSchema)
    .max(MAX_REPORT_EXTRA_PHOTOS, `Podés subir hasta ${MAX_REPORT_EXTRA_PHOTOS} fotos extra`)
    .optional(),
});

// la principal no se repite entre las extra
function rejectDuplicatedMainPhoto(
  data: { imageUrl?: string; extraImageUrls?: string[] },
  ctx: z.RefinementCtx
): void {
  if (data.imageUrl && data.extraImageUrls?.includes(data.imageUrl)) {
    ctx.addIssue({ code: "custom", path: ["extraImageUrls"], message: "La foto principal no puede repetirse" });
  }
}

export const createReportSchema = reportBaseSchema.superRefine(rejectDuplicatedMainPhoto);

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
export const updateReportSchema = reportBaseSchema
  .extend({ status: z.literal(ReportStatus.resolved).optional() })
  .partial()
  .superRefine(rejectDuplicatedMainPhoto);

export const reportIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const reportMatchParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  matchId: z.coerce.number().int().positive(),
});

export const listReportsQuerySchema = z.object({
  type: z.enum([ReportType.lost, ReportType.found]).optional(),
  status: z
    .enum([ReportStatus.pending, ReportStatus.published, ReportStatus.rejected, ReportStatus.resolved, ReportStatus.hidden])
    .optional(),
  breed: z.string().min(1).optional(),
  zone: z.string().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

// posibles duplicados mientras se crea un reporte (#211)
export const similarReportsSchema = z.object({
  reportType: z.enum([ReportType.lost, ReportType.found]),
  location: locationSchema,
  imageUrl: r2ImageUrlSchema.optional(),
});

export type SimilarReportsInput = z.infer<typeof similarReportsSchema>;

export const setCustomFlyerSchema = z.object({
  flyerUrl: r2ImageUrlSchema,
});

export type SetCustomFlyerInput = z.infer<typeof setCustomFlyerSchema>;

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
