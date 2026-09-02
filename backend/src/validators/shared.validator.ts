import { z } from "zod";

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
