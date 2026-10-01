import { api } from './api'
import type { ReportFlagDTO, ReportFlagStatus } from '@/types/moderation.types'

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
