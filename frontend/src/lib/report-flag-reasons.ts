import type { ReportFlagReason } from '@/types/moderation.types'

// motivos de denuncia de un reporte, en el orden del formulario
export const REPORT_FLAG_REASON_LABELS: Record<ReportFlagReason, string> = {
  not_an_animal: 'No es un animal',
  offensive: 'Contenido ofensivo',
  spam: 'Spam o publicidad',
  duplicate: 'Duplicado',
  false_info: 'Información falsa',
  other: 'Otro',
}

export const REPORT_FLAG_REASONS = Object.keys(REPORT_FLAG_REASON_LABELS) as ReportFlagReason[]
