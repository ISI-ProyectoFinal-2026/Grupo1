import { api } from './api'
import type {
  CreatedReportFlagDTO,
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

// Denuncia de un usuario logueado sobre un reporte. 409 si ese usuario ya lo
// habia denunciado.
export async function createReportFlag(reportId: number, reason: string): Promise<CreatedReportFlagDTO> {
  const { data } = await api.post<CreatedReportFlagDTO>(`/reports/${reportId}/flags`, { reason })
  return data
}
