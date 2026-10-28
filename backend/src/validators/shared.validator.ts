import { z } from "zod";
import { hasAmbiguousUrlChars, normalizeR2PublicUrl } from "../services/storage.service";

// coordenadas WGS84
export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const SAFE_URL_PROTOCOLS = ["http:", "https:"];

/**
 * URL restringida a http/https.
 *
 * `z.string().url()` delega en el parser de URL de la plataforma, que acepta
 * cualquier esquema sintácticamente válido: `javascript:`, `data:`, `vbscript:`
 * y `file:` pasan la validación. Eso no alcanza para una URL que la escribe otro
 * usuario y que el frontend termina renderizando en un `<a href>` y un `<img src>`
 * (ver MessageBubble.tsx), así que acá se acota el esquema explícitamente.
 *
 * No usar `z.string().url()` pelado para nada que venga de un usuario y se
 * vuelva a renderizar.
 */
export const safeHttpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      return SAFE_URL_PROTOCOLS.includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "La URL debe usar http o https");

const R2_IMAGE_MESSAGE = "La imagen debe haber sido subida a PATITAS";

// solo imágenes del bucket R2 propio, devueltas normalizadas (SSRF, #229)
export const r2ImageUrlSchema = z
  .string()
  // sobre el texto crudo: url() recorta los espacios de los bordes
  .refine((value) => !hasAmbiguousUrlChars(value), R2_IMAGE_MESSAGE)
  .pipe(safeHttpUrlSchema)
  .transform((value, ctx) => {
    const normalized = normalizeR2PublicUrl(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: R2_IMAGE_MESSAGE });
      return z.NEVER;
    }
    return normalized;
  });
