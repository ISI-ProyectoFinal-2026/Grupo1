import { z } from "zod";

// Regla única de contraseña: la usan el registro y el reset, así una cuenta
// nunca puede quedar con una contraseña más débil que la que pide el alta.
const passwordSchema = z
  .string()
  .min(8)
  .regex(/[a-z]/, "La contraseña debe tener al menos una minúscula")
  .regex(/[A-Z]/, "La contraseña debe tener al menos una mayúscula")
  .regex(/[0-9]/, "La contraseña debe tener al menos un número");

// Los tokens de los links son 32 bytes en base64url (43 caracteres); el tope
// solo evita hashear strings arbitrariamente largos.
const linkTokenSchema = z.string().min(1).max(256);

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  token: linkTokenSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: linkTokenSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
