import { z } from "zod";
import { ReportType, ReportStatus } from "@prisma/client";

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const createReportSchema = z.object({
  userId: z.number().int().positive(),
  petId: z.number().int().positive().optional(),
  reportType: z.enum([ReportType.lost, ReportType.found]),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  imageUrl: z.string().min(1).optional(),
  location: locationSchema,
  locationAddress: z.string().min(1).optional(),
});

export const updateReportSchema = createReportSchema
  .omit({ userId: true })
  .extend({ status: z.enum([ReportStatus.pending, ReportStatus.published, ReportStatus.rejected, ReportStatus.resolved]).optional() })
  .partial();

export const reportIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listReportsQuerySchema = z.object({
  type: z.enum([ReportType.lost, ReportType.found]).optional(),
  status: z.enum([ReportStatus.pending, ReportStatus.published, ReportStatus.rejected, ReportStatus.resolved]).optional(),
});

export const closeReportSchema = z.object({
  userId: z.number().int().positive(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type CloseReportInput = z.infer<typeof closeReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
