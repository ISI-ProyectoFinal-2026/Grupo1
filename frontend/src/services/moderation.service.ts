import { api } from './api'
import type {
  AccountReportDTO,
  AccountReportSeverity,
  CreatedReportFlagDTO,
  CreateReportFlagInput,
  ReportedAccountDTO,
  ReportFlagDTO,
  ReportFlagStatus,
  ResolveReportFlagAction,
} from '@/types/moderation.types'

// Cola de moderacion. Ambos endpoints exigen rol moderador/admin: sin el, el
// backend responde 403.
export async function listReportFlags(status?: ReportFlagStatus): Promise<ReportFlagDTO[]> {
  const { data } = await api.get<ReportFlagDTO[]>('/report-flags', {
    params: status ? { status } : {},
  })
  return data
}

// accept oculta el reporte y cierra sus demas denuncias; dismiss lo deja publicado
export async function resolveReportFlag(id: number, action: ResolveReportFlagAction): Promise<ReportFlagDTO> {
  const { data } = await api.patch<ReportFlagDTO>(`/report-flags/${id}`, { action })
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
