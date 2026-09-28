import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import type { ReportStatus } from '@/types/report.types'
import type { ReportFlagDTO } from '@/types/moderation.types'

const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Pendiente',
  published: 'Publicado',
  rejected: 'Oculto',
  resolved: 'Resuelto',
}

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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ReportFlagList({ flags, onResolve, resolvingId }: ReportFlagListProps) {
  if (flags.length === 0) {
    return (
      <p className='rounded border border-gray-200 px-4 py-6 text-center text-sm text-gray-500'>
        No hay reportes pendientes de moderación
      </p>
    )
  }

  return (
    <ul className='divide-y divide-gray-100 rounded border border-gray-200'>
      {flags.map((flag) => (
        <li key={flag.id} className='flex flex-col gap-2 px-4 py-3'>
          <div className='flex items-center justify-between gap-3'>
            <Link
              to={`/reports/${flag.reportId}`}
              className='text-sm font-medium text-blue-600 hover:underline'
            >
              {flag.report.title}
            </Link>
            <Badge
              label={REPORT_STATUS_LABELS[flag.report.status]}
              color={REPORT_STATUS_COLORS[flag.report.status]}
            />
          </div>

          <p className='text-sm text-gray-600'>{flag.reason}</p>

          <div className='flex items-center gap-3'>
            <time className='text-xs text-gray-400' dateTime={flag.createdAt}>
              {formatDate(flag.createdAt)}
            </time>
            {flag.status === 'pending' ? (
              <button
                type='button'
                onClick={() => onResolve(flag.id)}
                disabled={resolvingId === flag.id}
                className='text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline'
              >
                Resolver y ocultar
              </button>
            ) : (
              <span className='text-xs text-gray-400'>Revisado</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default ReportFlagList
