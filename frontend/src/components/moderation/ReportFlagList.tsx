import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/buttonClasses'
import type { ReportStatus } from '@/types/report.types'
import type { ReportFlagDTO } from '@/types/moderation.types'
import { REPORT_STATUS_LABELS } from '@/lib/report-status'

const REPORT_STATUS_COLORS: Record<ReportStatus, string> = {
  pending: '#a16207',
  published: '#15803d',
  rejected: '#b91c1c',
  resolved: '#1d4ed8',
}

interface ReportFlagListProps {
  flags: ReportFlagDTO[]
  onResolve: (id: number) => void
  resolvingId: number | null
}

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(value: string) {
  return dateFormat.format(new Date(value))
}

function ReportFlagList({ flags, onResolve, resolvingId }: ReportFlagListProps) {
  if (flags.length === 0) {
    return (
      <p className='rounded-card border border-dashed border-line px-4 py-10 text-center text-ink-muted'>
        No hay reportes pendientes de moderación
      </p>
    )
  }

  return (
    <ul className='flex flex-col gap-3'>
      {flags.map((flag) => (
        <li key={flag.id} className='card flex flex-col gap-2 p-4'>
          <div className='flex items-start justify-between gap-3'>
            <Link
              to={`/reports/${flag.reportId}`}
              className='min-w-0 break-words font-display text-display-sm text-ink underline-offset-4 hover:underline'
            >
              {flag.report.title}
            </Link>
            <Badge
              label={REPORT_STATUS_LABELS[flag.report.status]}
              color={REPORT_STATUS_COLORS[flag.report.status]}
              className='shrink-0'
            />
          </div>

          <p className='break-words border-l-4 border-line pl-3 text-ink'>{flag.reason}</p>

          <div className='flex flex-wrap items-center justify-between gap-3'>
            <time className='text-sm text-ink-muted' dateTime={flag.createdAt}>
              {formatDate(flag.createdAt)}
            </time>
            {flag.status === 'pending' ? (
              <button
                type='button'
                onClick={() => onResolve(flag.id)}
                disabled={resolvingId === flag.id}
                className={buttonClasses('danger', 'sm')}
              >
                Resolver y ocultar
              </button>
            ) : (
              <span className='text-sm font-bold text-ink-muted'>Revisado</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default ReportFlagList
