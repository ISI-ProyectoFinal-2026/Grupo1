import { z } from "zod";
import { todayInArgentina } from "@/lib/format";

export const reportLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Los campos de texto opcionales arrancan como "" en el estado del formulario.
 * Enviarlos asi rebotaba con 400, porque el backend los declara
 * `z.string().min(1).optional()`: una cadena vacia no es "ausente", es una
 * cadena invalida. Se normaliza a undefined para que la clave no viaje.
 */
const optionalText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

// fecha del suceso (#259)
const eventDateField = z
  .string({ error: "Indicá la fecha del suceso" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha del suceso inválida")
  .refine((value) => value <= todayInArgentina(), "La fecha del suceso no puede ser futura");

// fotos extra además de la principal (4 en total)
export const MAX_REPORT_EXTRA_PHOTOS = 3;
export const MAX_REPORT_PHOTOS = MAX_REPORT_EXTRA_PHOTOS + 1;

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const createReportSchema = z.object({
  reportType: z.enum(["lost", "found"]),
  title: z.string().min(5, "Mínimo 5 caracteres").max(255),
  description: optionalText,
  imageUrl: z.string({ error: "Sube una foto de la mascota" }).url(),
  extraImageUrls: z
    .array(z.string().url())
    .max(MAX_REPORT_EXTRA_PHOTOS, `Podés subir hasta ${MAX_REPORT_PHOTOS} fotos`)
    .optional(),
  // El mensaje por defecto de Zod para una clave ausente es "expected object,
  // received undefined", que no le dice nada al usuario del formulario.
  location: z.object(reportLocationSchema.shape, {
    error: "Marcá la ubicación en el mapa o usá tu ubicación actual",
  }),
  locationAddress: optionalText,
  petId: z.number().optional(),
  showPhoneOnFlyer: z.boolean().optional(),
  // opcional para editar reportes anteriores sin fecha
  eventDate: z.preprocess(blankToUndefined, eventDateField.optional()),
});

// al crear, la fecha del suceso es obligatoria
export const newReportSchema = createReportSchema.extend({
  eventDate: z.preprocess(blankToUndefined, eventDateField),
});

export type CreateReportFormData = z.infer<typeof createReportSchema>;
