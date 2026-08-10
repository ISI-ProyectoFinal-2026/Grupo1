import { z } from "zod";

export const createPetSchema = z.object({
  userId: z.number().int().positive(),
  name: z.string().min(1).optional(),
  species: z.string().min(1).optional(),
  breed: z.string().min(1).optional(),
  age: z.number().int().min(0).optional(),
  description: z.string().min(1).optional(),
  microchipId: z.string().min(1).optional(),
});

export const updatePetSchema = createPetSchema.omit({ userId: true }).partial();

export const petIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreatePetInput = z.infer<typeof createPetSchema>;
export type UpdatePetInput = z.infer<typeof updatePetSchema>;
