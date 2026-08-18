import { api } from "./api";
import type { Match } from "../types/match";
import type {
  CloseReportInput,
  CreateReportFlagInput,
  CreateReportInput,
  ListReportsFilters,
  Report,
  ReportFlag,
  UpdateReportInput,
} from "../types/report";

export async function getReports(filters: ListReportsFilters = {}): Promise<Report[]> {
  const { data } = await api.get<Report[]>("/reports", { params: filters });
  return data;
}

export async function getReport(id: number): Promise<Report> {
  const { data } = await api.get<Report>(`/reports/${id}`);
  return data;
}

export async function createReport(input: CreateReportInput): Promise<Report> {
  const { data } = await api.post<Report>("/reports", input);
  return data;
}

export async function updateReport(id: number, input: UpdateReportInput): Promise<Report> {
  const { data } = await api.put<Report>(`/reports/${id}`, input);
  return data;
}

export async function deleteReport(id: number): Promise<void> {
  await api.delete(`/reports/${id}`);
}

export async function closeReport(id: number, input: CloseReportInput): Promise<Report> {
  const { data } = await api.post<Report>(`/reports/${id}/close`, input);
  return data;
}

export async function getReportMatches(id: number): Promise<Match[]> {
  const { data } = await api.get<Match[]>(`/reports/${id}/matches`);
  return data;
}

export async function flagReport(
  id: number,
  input: CreateReportFlagInput,
): Promise<ReportFlag> {
  const { data } = await api.post<ReportFlag>(`/reports/${id}/flags`, input);
  return data;
}
