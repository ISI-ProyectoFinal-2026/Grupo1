import { z } from "zod";
import { linkTokenSchema } from "./auth.validator";

// Cabe un TOTP (6 dígitos) o un código de recuperación (`XXXXX-XXXXX`, con
// espacios sueltos si lo pegaron); el tope solo evita procesar strings enormes.
const codeSchema = z.string().trim().min(1).max(32);

export const twoFactorLoginSchema = z.object({
  twoFactorToken: linkTokenSchema,
  code: codeSchema,
});

export type TwoFactorLoginInput = z.infer<typeof twoFactorLoginSchema>;
