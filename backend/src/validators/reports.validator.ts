import { z } from "zod";
import { ReportType, ReportStatus } from "@prisma/client";

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const createReportSchema = z.object({
  petId: z.number().int().positive().optional(),
  reportType: z.enum([ReportType.lost, ReportType.found]),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  imageUrl: z.string().min(1).optional(),
  location: locationSchema,
  locationAddress: z.string().min(1).optional(),
});

export const updateReportSchema = createReportSchema
  .extend({ status: z.enum([ReportStatus.pending, ReportStatus.published, ReportStatus.rejected, ReportStatus.resolved]).optional() })
  .partial();

export const reportIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listReportsQuerySchema = z.object({
  type: z.enum([ReportType.lost, ReportType.found]).optional(),
  status: z.enum([ReportStatus.pending, ReportStatus.published, ReportStatus.rejected, ReportStatus.resolved]).optional(),
  breed: z.string().min(1).optional(),
  zone: z.string().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
