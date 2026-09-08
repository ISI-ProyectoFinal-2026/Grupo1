import { api } from "./api";
import type { ReportDTO, CreateReportInput, ListReportsQuery, MatchDTO } from "@/types/report.types";

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

export async function getMatches(id: number): Promise<MatchDTO[]> {
  const { data } = await api.get<MatchDTO[]>(`/reports/${id}/matches`);
  return data;
}

export async function getFlyer(id: number): Promise<{ flyerUrl: string }> {
  const { data } = await api.get<{ flyerUrl: string }>(`/reports/${id}/flyer`);
  return data;
}
