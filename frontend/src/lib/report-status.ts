import type { ReportStatus } from "@/types/report.types";

/** User-facing (Spanish) label for each report status the API returns. */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Pendiente",
  published: "Publicado",
  rejected: "Oculto",
  resolved: "Resuelto",
};
