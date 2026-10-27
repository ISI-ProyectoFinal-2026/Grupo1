import { z } from "zod";
import { r2ImageUrlSchema } from "./shared.validator";

const MAX_FILE_SIZE = 10_000_000; // 10 MB

export const presignUploadSchema = z.object({
  fileName: z.string().min(1, "Se requiere el nombre del archivo"),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE, `El archivo no puede superar los ${MAX_FILE_SIZE / 1_000_000} MB`),
});

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

export const analyzeImageSchema = z.object({
  // Only images from our own bucket: otherwise the endpoint lets any user probe
  // arbitrary URLs through the AI service (SSRF).
  imageUrl: r2ImageUrlSchema,
});

export type AnalyzeImageInput = z.infer<typeof analyzeImageSchema>;
