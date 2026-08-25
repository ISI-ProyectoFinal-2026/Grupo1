import { api } from "./api";
import type { ReportDTO, CreateReportInput, ListReportsQuery } from "@/types/report.types";

export async function listReports(filters?: ListReportsQuery): Promise<ReportDTO[]> {
  const { data } = await api.get<ReportDTO[]>("/reports", { params: filters });
  return data;
}

export async function getReport(id: number): Promise<ReportDTO> {
  const { data } = await api.get<ReportDTO>(`/reports/${id}`);
  return data;
}

export async function createReport(input: CreateReportInput): Promise<ReportDTO> {
  const { data } = await api.post<ReportDTO>("/reports", input);
  return data;
}

export async function updateReport(id: number, input: Partial<CreateReportInput>): Promise<ReportDTO> {
  const { data } = await api.put<ReportDTO>(`/reports/${id}`, input);
  return data;
}

export async function deleteReport(id: number): Promise<void> {
  await api.delete(`/reports/${id}`);
}

export async function closeReport(id: number): Promise<ReportDTO> {
  const { data } = await api.post<ReportDTO>(`/reports/${id}/close`);
  return data;
}
