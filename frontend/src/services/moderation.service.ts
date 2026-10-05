import { api } from './api'
import type { CreatedReportFlagDTO, ReportFlagDTO, ReportFlagStatus } from '@/types/moderation.types'

// Cola de moderacion. Ambos endpoints exigen rol moderador/admin: sin el, el
// backend responde 403.
export async function listReportFlags(status?: ReportFlagStatus): Promise<ReportFlagDTO[]> {
  const { data } = await api.get<ReportFlagDTO[]>('/report-flags', {
    params: status ? { status } : {},
  })
  return data
}

// PATCH sin cuerpo: el backend marca el flag como reviewed y deja el reporte
// denunciado en rejected (oculto) en una sola transaccion.
export async function resolveReportFlag(id: number): Promise<ReportFlagDTO> {
  const { data } = await api.patch<ReportFlagDTO>(`/report-flags/${id}`)
  return data
}

// Denuncia de un usuario logueado sobre un reporte. 409 si ese usuario ya lo
// habia denunciado.
export async function createReportFlag(reportId: number, reason: string): Promise<CreatedReportFlagDTO> {
  const { data } = await api.post<CreatedReportFlagDTO>(`/reports/${reportId}/flags`, { reason })
  return data
}
