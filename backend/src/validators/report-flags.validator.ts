import { z } from "zod";
import { ReportFlagReason, ReportFlagStatus } from "@prisma/client";

// other exige un detalle (#218)
export const createReportFlagSchema = z
  .object({
    reason: z.nativeEnum(ReportFlagReason),
    detail: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.reason !== ReportFlagReason.other || !!data.detail, {
    message: "El detalle es obligatorio cuando el motivo es other",
    path: ["detail"],
  });

export const reportFlagReportIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const moderationReportIdParamSchema = z.object({
  reportId: z.coerce.number().int().positive(),
});

// acción del moderador sobre un reporte denunciado
export const moderationActionSchema = z.object({
  action: z.enum(["hide", "dismiss", "restore", "confirm"]),
});

export const listReportFlagsQuerySchema = z.object({
  status: z.enum([ReportFlagStatus.pending, ReportFlagStatus.reviewed, ReportFlagStatus.dismissed]).optional(),
});

export type CreateReportFlagInput = z.infer<typeof createReportFlagSchema>;
export type ModerationAction = z.infer<typeof moderationActionSchema>["action"];
export type ListReportFlagsQuery = z.infer<typeof listReportFlagsQuerySchema>;
