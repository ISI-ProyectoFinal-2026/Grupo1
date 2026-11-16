import type { ReportStatus, ReportType } from '@/types/report.types'

// valores segun el enum ReportFlagStatus de Prisma
export type ReportFlagStatus = 'pending' | 'reviewed' | 'dismissed'

// valores segun el enum ReportFlagReason de Prisma
export type ReportFlagReason = 'not_an_animal' | 'offensive' | 'spam' | 'duplicate' | 'false_info' | 'other'

// cuerpo de POST /api/reports/:id/flags; detail es obligatorio solo con 'other'
export interface CreateReportFlagInput {
  reason: ReportFlagReason
  detail?: string
}

// acciones de moderación por reporte (#218): hide/dismiss sobre publicados, restore/confirm sobre ocultos
export type ModerationAction = 'hide' | 'dismiss' | 'restore' | 'confirm'

// PATCH /api/report-flags/reports/:reportId
export interface ModerationResultDTO {
  id: number
  status: ReportStatus
}

// GET /api/report-flags/reports: una entrada por reporte con denuncias pendientes
export interface ReportFlagGroupDTO {
  report: {
    id: number
    title: string
    status: ReportStatus
    reportType: ReportType
    imageUrl: string | null
    description: string | null
  }
  flagCount: number
  reasonCounts: Partial<Record<ReportFlagReason, number>>
  otherDetails: string[]
  lastFlaggedAt: string
}

// POST /api/reports/:id/flags devuelve el flag recién creado
export interface CreatedReportFlagDTO {
  id: number
  reportId: number
  userId: number
  reason: string
  detail?: string | null
  status: ReportFlagStatus
  createdAt: string
}

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
