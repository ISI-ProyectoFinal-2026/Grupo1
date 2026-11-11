import { api } from './api'
import type {
  AccountReportDTO,
  AccountReportSeverity,
  CreatedReportFlagDTO,
  CreateReportFlagInput,
  ReportedAccountDTO,
  ModerationAction,
  ModerationResultDTO,
  ReportFlagGroupDTO,
} from '@/types/moderation.types'

// Cola de moderación agrupada por reporte. Exige rol moderador/admin: sin él, 403.
export async function listReportFlagGroups(): Promise<ReportFlagGroupDTO[]> {
  const { data } = await api.get<ReportFlagGroupDTO[]>('/report-flags/reports')
  return data
}

// hide/dismiss sobre publicados; restore/confirm sobre ocultos. 409 si otro moderador ya lo resolvió
export async function moderateReport(reportId: number, action: ModerationAction): Promise<ModerationResultDTO> {
  const { data } = await api.patch<ModerationResultDTO>(`/report-flags/reports/${reportId}`, { action })
  return data
}

// Denuncia de un usuario logueado sobre un reporte, con motivo tipificado. 409 si
// ya lo habia denunciado.
export async function createReportFlag(reportId: number, input: CreateReportFlagInput): Promise<CreatedReportFlagDTO> {
  const { data } = await api.post<CreatedReportFlagDTO>(`/reports/${reportId}/flags`, input)
  return data
}

// denuncia de una cuenta con gravedad (#267). 409 si ya la denunció o tiene una sanción en curso
export async function createAccountReport(
  reportedUserId: number,
  severity: AccountReportSeverity
): Promise<AccountReportDTO> {
  const { data } = await api.post<AccountReportDTO>('/account-reports', { reportedUserId, severity })
  return data
}

// cuentas denunciadas para moderacion; exige rol moderador/admin
export async function listReportedAccounts(): Promise<ReportedAccountDTO[]> {
  const { data } = await api.get<ReportedAccountDTO[]>('/account-reports')
  return data
}
