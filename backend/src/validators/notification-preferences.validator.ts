import { z } from "zod";

export const updatePreferencesBodySchema = z
  .object({
    notifyMatch: z.boolean(),
    notifyMessage: z.boolean(),
    notifyStatusChange: z.boolean(),
    notifyNearby: z.boolean(),
    nearbyRadiusKm: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
    nearbyReportType: z.enum(["lost", "found", "both"]),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "Enviá al menos un campo" });

export const locationConsentBodySchema = z.object({
  status: z.enum(["accepted", "declined"]),
});

export const locationBodySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesBodySchema>;
export type LocationInput = z.infer<typeof locationBodySchema>;
