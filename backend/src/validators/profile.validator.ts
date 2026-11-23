import { z } from "zod";
import { codeSchema } from "./two-factor.validator";

// teléfono argentino flexible: dígitos, espacios, guiones, paréntesis y un + inicial
const PHONE_CHARS = /^\+?[0-9 ()-]+$/;
const PHONE_MIN_DIGITS = 8;
const PHONE_MAX_DIGITS = 15;
const PHONE_MAX_LENGTH = 30;

const phoneSchema = z
  .string()
  .trim()
  .max(PHONE_MAX_LENGTH)
  .refine((value) => value === "" || PHONE_CHARS.test(value), "El teléfono tiene caracteres no permitidos")
  .refine((value) => {
    if (value === "") return true;
    const digits = value.replace(/\D/g, "").length;
    return digits >= PHONE_MIN_DIGITS && digits <= PHONE_MAX_DIGITS;
  }, `El teléfono debe tener entre ${PHONE_MIN_DIGITS} y ${PHONE_MAX_DIGITS} dígitos`)
  // vacío borra el teléfono
  .transform((value) => (value === "" ? null : value));

// PATCH /auth/me: solo nombre y teléfono
export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(100).nullable().optional(),
    phone: phoneSchema.nullable().optional(),
  })
  .strict()
  .refine((data) => data.fullName !== undefined || data.phone !== undefined, "Indicá al menos un campo");

// DELETE /auth/me: reautenticación; el código solo si hay 2FA
export const accountDeleteSchema = z
  .object({
    password: z.string().min(1).max(256),
    code: codeSchema.optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type AccountDeleteInput = z.infer<typeof accountDeleteSchema>;
