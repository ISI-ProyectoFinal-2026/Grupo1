import { z } from "zod";

export const reportLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const createReportSchema = z.object({
  reportType: z.enum(["lost", "found"]),
  title: z.string().min(5, "Mínimo 5 caracteres").max(255),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  location: reportLocationSchema,
  locationAddress: z.string().optional(),
  petId: z.number().optional(),
});

export type CreateReportFormData = z.infer<typeof createReportSchema>;

export const imageUploadSchema = z.object({
  fileName: z.string(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export type ImageUploadData = z.infer<typeof imageUploadSchema>;
