import { z } from "zod";
import { BusinessCategory } from "@prisma/client";

/**
 * `plan` no es parte del alta: todo comercio nace `FREE` (default de
 * `Business.plan` en `schema.prisma`). Aceptarlo dejaba que cualquiera se
 * registrara directo en PREMIUM con un `POST /api/businesses`, sin pago ni
 * autorización. El cambio de plan pertenece al futuro flujo de pago.
 *
 * Zod descarta las claves no declaradas, así que enviarlo se ignora.
 */
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

/**
 * `plan` y `cuit` no son editables por la API.
 *
 * `plan` ya no está en `createBusinessSchema` (ver arriba). Aceptarlo en el
 * update dejaba que cualquier dueño se auto-otorgara PREMIUM con un
 * `PUT /api/businesses/me`; `businessesService.updateByUserId` sigue
 * soportándolo para cuando exista el flujo de pago.
 *
 * `cuit` es la identidad fiscal del comercio: el dashboard ya lo presenta como
 * `disabled`, pero esa restricción era solo del lado del cliente.
 *
 * Zod descarta las claves no declaradas, así que enviarlas es inocuo: se ignoran.
 */
export const updateBusinessSchema = createBusinessSchema.omit({ cuit: true }).partial();

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
