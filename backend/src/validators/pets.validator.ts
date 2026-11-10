import { z } from "zod";
import { r2ImageUrlSchema } from "./shared.validator";

export const MAX_PET_PHOTOS = 4;

export const createPetSchema = z.object({
  name: z.string().min(1),
  species: z.string().min(1).optional(),
  breed: z.string().min(1),
  age: z.number().int().min(0),
  color: z.string().min(1),
  description: z.string().min(1),
  photoUrls: z
    .array(r2ImageUrlSchema)
    .min(1, "Se requiere al menos una foto")
    .max(MAX_PET_PHOTOS, `Podés subir hasta ${MAX_PET_PHOTOS} fotos`),
  microchipId: z.string().min(1).optional(),
});

export const updatePetSchema = createPetSchema.partial();

export const petIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreatePetInput = z.infer<typeof createPetSchema>;
export type UpdatePetInput = z.infer<typeof updatePetSchema>;
