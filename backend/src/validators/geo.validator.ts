import { z } from "zod";

export const geoNearbyQuerySchema = z.object({
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

export const geoMapQuerySchema = z.object({
  bounds: boundsSchema,
});

export type GeoNearbyQuery = z.infer<typeof geoNearbyQuerySchema>;
export type BoundingBox = z.infer<typeof boundsSchema>;
