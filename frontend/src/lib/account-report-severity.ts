import type { AccountReportSeverity } from '@/types/moderation.types'

// de menor a mayor gravedad
export const ACCOUNT_REPORT_SEVERITIES: AccountReportSeverity[] = ['mild', 'moderate', 'severe']

export const ACCOUNT_REPORT_SEVERITY_LABELS: Record<AccountReportSeverity, string> = {
  mild: 'Leve',
  moderate: 'Media',
  severe: 'Fuerte',
}

// mismo umbral que el backend (#267)
export const ACCOUNT_REPORT_THRESHOLD = 5
