import { z } from "zod";

export const sanctionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const sanctionDecisionSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
