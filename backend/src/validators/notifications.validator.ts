import { z } from "zod";

export const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const matchNotificationBodySchema = z.object({
  lostReportId: z.number().int().positive(),
  foundReportId: z.number().int().positive(),
  similarityScore: z.number().min(0).max(1),
});

export type MatchNotificationInput = z.infer<typeof matchNotificationBodySchema>;
