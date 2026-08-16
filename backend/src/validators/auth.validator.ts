import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[a-z]/, "La contraseña debe tener al menos una minúscula")
    .regex(/[A-Z]/, "La contraseña debe tener al menos una mayúscula")
    .regex(/[0-9]/, "La contraseña debe tener al menos un número"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
