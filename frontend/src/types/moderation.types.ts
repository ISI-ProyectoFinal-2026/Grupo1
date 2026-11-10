import type { ReportStatus } from '@/types/report.types'

// valores segun el enum ReportFlagStatus de Prisma
export type ReportFlagStatus = 'pending' | 'reviewed' | 'dismissed'

// accept = ocultar el reporte; dismiss = descartar la denuncia (#223)
export type ResolveReportFlagAction = 'accept' | 'dismiss'

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

// POST /api/reports/:id/flags devuelve el flag recien creado, sin el reporte
export type CreatedReportFlagDTO = Omit<ReportFlagDTO, 'report'>

// denuncia de cuentas (#267), valores segun el enum AccountReportSeverity de Prisma
export type AccountReportSeverity = 'mild' | 'moderate' | 'severe'

export interface AccountReportDTO {
  id: number
  reportedUserId: number
  reporterId: number
  severity: AccountReportSeverity
  createdAt: string
}

// GET /api/account-reports: una fila por cuenta, solo denuncias del ciclo abierto
export interface ReportedAccountDTO {
  reportedUser: { id: number; fullName: string | null }
  reportCount: number
  severityCounts: Record<AccountReportSeverity, number>
  thresholdReached: boolean
  resultingSeverity: AccountReportSeverity | null
  lastReportedAt: string
}
