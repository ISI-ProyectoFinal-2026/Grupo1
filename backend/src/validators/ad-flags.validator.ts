import { z } from "zod";
import { AdFlagStatus } from "@prisma/client";

export const createAdFlagSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const adFlagIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// remove = dar de baja el anuncio; dismiss = desestimar la denuncia
export const resolveAdFlagSchema = z.object({
  action: z.enum(["remove", "dismiss"]),
});

export const listAdFlagsQuerySchema = z.object({
  status: z.enum([AdFlagStatus.pending, AdFlagStatus.removed, AdFlagStatus.dismissed]).optional(),
});

export type CreateAdFlagInput = z.infer<typeof createAdFlagSchema>;
export type ResolveAdFlagAction = z.infer<typeof resolveAdFlagSchema>["action"];
export type ListAdFlagsQuery = z.infer<typeof listAdFlagsQuerySchema>;
