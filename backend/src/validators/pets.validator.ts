import { z } from "zod";

export const createPetSchema = z.object({
  userId: z.number().int().positive(),
  name: z.string().min(1),
  species: z.string().min(1).optional(),
  breed: z.string().min(1),
  age: z.number().int().min(0),
  color: z.string().min(1),
  description: z.string().min(1),
  photoUrls: z.array(z.string().min(1)).min(1, "Se requiere al menos una foto"),
  microchipId: z.string().min(1).optional(),
});

export const updatePetSchema = createPetSchema.omit({ userId: true }).partial();

export const petIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreatePetInput = z.infer<typeof createPetSchema>;
export type UpdatePetInput = z.infer<typeof updatePetSchema>;
