import client from "./client";
import type { CreateReportInput, ReportDTO } from "@/types";

export async function create(data: CreateReportInput): Promise<ReportDTO> {
  const { data: report } = await client.post<ReportDTO>("/reports", data);
  return report;
}
