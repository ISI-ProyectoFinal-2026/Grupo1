import { z } from "zod";
import { BusinessCategory, SubscriptionPeriod } from "@prisma/client";
import { locationSchema, safeHttpUrlSchema } from "./shared.validator";

// enlaces del perfil público
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_URL_LENGTH = 300;
const MAX_SOCIAL_LINKS = 5;

const profileUrlSchema = z.string().trim().max(MAX_URL_LENGTH).pipe(safeHttpUrlSchema);

// texto vacío = sin web, como la descripción
const websiteSchema = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(profileUrlSchema.nullable())
  .nullable();

// las líneas vacías se descartan
const socialLinksSchema = z
  .array(z.string())
  .transform((links) => links.map((link) => link.trim()).filter(Boolean))
  .pipe(z.array(profileUrlSchema).max(MAX_SOCIAL_LINKS));

// texto vacío = sin descripción
const descriptionSchema = z
  .string()
  .trim()
  .max(MAX_DESCRIPTION_LENGTH)
  .transform((value) => value || null)
  .nullable();

/**
 * `plan` no es parte del alta: todo comercio nace `FREE` (default de
 * `Business.plan` en `schema.prisma`). Aceptarlo dejaba que cualquiera se
 * registrara directo en PREMIUM con un `POST /api/businesses`, sin pago ni
 * autorización. El plan solo cambia con `POST /api/businesses/me/subscription`.
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
  location: locationSchema,
  description: descriptionSchema.optional(),
  website: websiteSchema.optional(),
  socialLinks: socialLinksSchema.optional(),
});

/**
 * `plan` y `cuit` no son editables por la API.
 *
 * `plan` ya no está en `createBusinessSchema` (ver arriba). Aceptarlo en el
 * update dejaba que cualquier dueño se auto-otorgara PREMIUM con un
 * `PUT /api/businesses/me`.
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

export const subscribeSchema = z.object({
  period: z.enum([SubscriptionPeriod.MONTHLY, SubscriptionPeriod.ANNUAL]),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type ListBusinessesQuery = z.infer<typeof listBusinessesQuerySchema>;
