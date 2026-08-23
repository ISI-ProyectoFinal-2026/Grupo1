import { z } from "zod";
import { BusinessCategory } from "@prisma/client";

export const createBusinessSchema = z.object({
  name: z.string().min(1),
  cuit: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(1),
  category: z.enum([
    BusinessCategory.VETERINARIA,
    BusinessCategory.REFUGIO,
    BusinessCategory.PET_SHOP,
    BusinessCategory.OTRO,
  ]),
});

export const updateBusinessSchema = createBusinessSchema.partial();

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
