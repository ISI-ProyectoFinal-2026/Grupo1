import { z } from "zod";
import { AdEventType, AdPlacement, AdStatus } from "@prisma/client";
import { r2ImageUrlSchema } from "./shared.validator";

// límites del anuncio (ADR-0024)
export const MIN_AD_RADIUS_KM = 1;
export const MAX_AD_RADIUS_KM = 20;
const MAX_TITLE_LENGTH = 60;
const MAX_BODY_LENGTH = 200;

export const createAdSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
  body: z.string().trim().min(1).max(MAX_BODY_LENGTH),
  imageUrl: r2ImageUrlSchema,
  radiusKm: z.number().int().min(MIN_AD_RADIUS_KM).max(MAX_AD_RADIUS_KM),
});

export const updateAdSchema = createAdSchema.partial();

// REMOVED solo lo asigna moderación
export const setAdStatusSchema = z.object({
  status: z.enum([AdStatus.ACTIVE, AdStatus.PAUSED]),
});

export const adIdParamSchema = z.object({
  adId: z.coerce.number().int().positive(),
});

// el detalle del reporte segmenta por su ubicación: exige reportId
export const adQuerySchema = z.discriminatedUnion("placement", [
  z.object({ placement: z.literal("feed"), reportId: z.undefined().optional() }),
  z.object({ placement: z.literal("report_detail"), reportId: z.coerce.number().int().positive() }),
]);

export const adEventSchema = z.object({
  type: z.enum([AdEventType.impression, AdEventType.click]),
  placement: z.enum([AdPlacement.feed, AdPlacement.report_detail]),
});

export type CreateAdInput = z.infer<typeof createAdSchema>;
export type UpdateAdInput = z.infer<typeof updateAdSchema>;
