import { z } from "zod";
import { BusinessCategory, BusinessPlan } from "@prisma/client";

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
  // PRO queda reservado/sin uso: no es seleccionable vía API.
  plan: z.enum([BusinessPlan.FREE, BusinessPlan.PREMIUM]).optional(),
});

/**
 * `plan` y `cuit` no son editables por la API.
 *
 * `plan` define qué features paga el comercio (`BusinessRegisterPage.tsx`: "Solo
 * el plan Premium permite publicar anuncios"). Aceptarlo en el update dejaba que
 * cualquier dueño se auto-otorgara PREMIUM con un `PUT /api/businesses/me`, sin
 * pago ni autorización. El cambio de plan pertenece a un flujo de pago, no a la
 * edición de perfil; `businessesService.updateByUserId` sigue soportándolo para
 * cuando ese flujo exista.
 *
 * `cuit` es la identidad fiscal del comercio: el dashboard ya lo presenta como
 * `disabled`, pero esa restricción era solo del lado del cliente.
 *
 * Zod descarta las claves no declaradas, así que enviarlas es inocuo: se ignoran.
 */
export const updateBusinessSchema = createBusinessSchema.omit({ plan: true, cuit: true }).partial();

export const businessIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listBusinessesQuerySchema = z.object({
  category: z
    .enum([
      BusinessCategory.VETERINARIA,
      BusinessCategory.REFUGIO,
      BusinessCategory.PET_SHOP,
      BusinessCategory.OTRO,
    ])
    .optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type ListBusinessesQuery = z.infer<typeof listBusinessesQuerySchema>;
