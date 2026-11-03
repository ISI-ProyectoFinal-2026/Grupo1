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

// accept = ocultar el reporte; dismiss = descartar la denuncia
export const resolveReportFlagSchema = z.object({
  action: z.enum(["accept", "dismiss"]),
});

export const listReportFlagsQuerySchema = z.object({
  status: z.enum([ReportFlagStatus.pending, ReportFlagStatus.reviewed, ReportFlagStatus.dismissed]).optional(),
});

export type CreateReportFlagInput = z.infer<typeof createReportFlagSchema>;
export type ResolveReportFlagAction = z.infer<typeof resolveReportFlagSchema>["action"];
export type ListReportFlagsQuery = z.infer<typeof listReportFlagsQuerySchema>;
