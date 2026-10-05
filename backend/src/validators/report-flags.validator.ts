import { z } from "zod";
import { ReportFlagStatus } from "@prisma/client";

export const createReportFlagSchema = z.object({
  reason: z.string().min(1),
});

export const reportFlagReportIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const reportFlagIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listReportFlagsQuerySchema = z.object({
  status: z.enum([ReportFlagStatus.pending, ReportFlagStatus.reviewed]).optional(),
});

export type CreateReportFlagInput = z.infer<typeof createReportFlagSchema>;
export type ListReportFlagsQuery = z.infer<typeof listReportFlagsQuerySchema>;
