import { z } from "zod";

export const createReportFlagSchema = z.object({
  userId: z.number().int().positive(),
  reason: z.string().min(1),
});

export const reportFlagReportIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateReportFlagInput = z.infer<typeof createReportFlagSchema>;
