import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import {
  ACCOUNT_REPORT_SEVERITIES,
  ACCOUNT_REPORT_SEVERITY_LABELS,
  ACCOUNT_REPORT_THRESHOLD,
} from '@/lib/account-report-severity'
import type { AccountReportSeverity, ReportedAccountDTO } from '@/types/moderation.types'

const SEVERITY_COLORS: Record<AccountReportSeverity, string> = {
  mild: '#8A5A0B',
  moderate: '#C4342B',
  severe: '#7A1F1A',
}

interface ReportedAccountListProps {
  accounts: ReportedAccountDTO[]
}

function ReportedAccountList({ accounts }: ReportedAccountListProps) {
  if (accounts.length === 0) {
    return (
      <EmptyState>
        <p className='text-ink-muted'>No hay cuentas denunciadas</p>
      </EmptyState>
    )
  }

  return (
    <ul className='flex flex-col gap-3'>
      {accounts.map((account) => (
        <li key={account.reportedUser.id} className='card flex flex-col gap-2 p-4'>
          <div className='flex items-start justify-between gap-3'>
            <p className='min-w-0 break-words font-display text-display-sm'>
              {account.reportedUser.fullName ?? `Usuario #${account.reportedUser.id}`}
            </p>
            {account.resultingSeverity && (
              <Badge
                label={`Gravedad resultante: ${ACCOUNT_REPORT_SEVERITY_LABELS[account.resultingSeverity]}`}
                color={SEVERITY_COLORS[account.resultingSeverity]}
                className='shrink-0'
              />
            )}
          </div>
          <p className='text-ink'>
            {account.thresholdReached
              ? `${account.reportCount} denuncias`
              : `${account.reportCount} de ${ACCOUNT_REPORT_THRESHOLD} denuncias`}
          </p>
          <p className='flex flex-wrap gap-x-4 text-sm text-ink-muted'>
            {ACCOUNT_REPORT_SEVERITIES.map((severity) => (
              <span key={severity}>
                {ACCOUNT_REPORT_SEVERITY_LABELS[severity]}: {account.severityCounts[severity]}
              </span>
            ))}
          </p>
        </li>
      ))}
    </ul>
  )
}

export default ReportedAccountList
