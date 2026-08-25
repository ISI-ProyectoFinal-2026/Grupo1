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
  // El mensaje por defecto de Zod para una clave ausente es "expected object,
  // received undefined", que no le dice nada al usuario del formulario.
  location: z.object(reportLocationSchema.shape, {
    error: "Indicá la ubicación con el botón de arriba",
  }),
  locationAddress: z.string().optional(),
  petId: z.number().optional(),
});

export type CreateReportFormData = z.infer<typeof createReportSchema>;

export const imageUploadSchema = z.object({
  fileName: z.string(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export type ImageUploadData = z.infer<typeof imageUploadSchema>;
