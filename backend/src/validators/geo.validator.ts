import { z } from "zod";
import { ReportType } from "@prisma/client";

export const GEO_DEFAULT_LIMIT = 200;
export const GEO_MAX_LIMIT = 500;

// filtros del feed + tope de resultados (#234)
const geoFiltersSchema = z.object({
  type: z.enum([ReportType.lost, ReportType.found]).optional(),
  zone: z.string().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(GEO_MAX_LIMIT).default(GEO_DEFAULT_LIMIT),
});

export const geoNearbyQuerySchema = geoFiltersSchema.extend({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive(),
});

const boundsSchema = z
  .string()
  .transform((value) => value.split(",").map((part) => Number(part.trim())))
  .refine((parts) => parts.length === 4 && parts.every((n) => Number.isFinite(n)), {
    message: "bounds debe tener el formato swLat,swLng,neLat,neLng",
  })
  .transform(([swLat, swLng, neLat, neLng]) => ({ swLat, swLng, neLat, neLng }))
  .refine(
    (bounds) =>
      Math.abs(bounds.swLat) <= 90 && Math.abs(bounds.neLat) <= 90 && Math.abs(bounds.swLng) <= 180 && Math.abs(bounds.neLng) <= 180,
    { message: "bounds fuera de rango: lat debe estar entre -90 y 90, lng entre -180 y 180" }
  );

export const geoMapQuerySchema = geoFiltersSchema.extend({
  bounds: boundsSchema,
});

export type GeoFilters = z.infer<typeof geoFiltersSchema>;
export type GeoNearbyQuery = z.infer<typeof geoNearbyQuerySchema>;
export type BoundingBox = z.infer<typeof boundsSchema>;
