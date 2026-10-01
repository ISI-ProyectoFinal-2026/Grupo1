import type { ReportStatus } from '@/types/report.types'

// valores segun el enum ReportFlagStatus de Prisma
export type ReportFlagStatus = 'pending' | 'reviewed'

// contexto del reporte denunciado que GET /api/report-flags incluye
export interface ReportFlagReport {
  id: number
  title: string
  status: ReportStatus
}

export interface ReportFlagDTO {
  id: number
  reportId: number
  userId: number
  reason: string
  status: ReportFlagStatus
  createdAt: string
  report: ReportFlagReport
}
