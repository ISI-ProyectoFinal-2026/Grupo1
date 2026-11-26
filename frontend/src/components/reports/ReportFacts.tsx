import { CalendarIcon, PinIcon } from '@/components/ui/icons'
import { formatLongDate, formatLongDay } from '@/lib/format'
import type { ReportDTO } from '@/types/report.types'

interface ReportFactsProps {
  report: Pick<
    ReportDTO,
    'locationAddress' | 'location' | 'createdAt' | 'eventDate' | 'publishedAt'
  >
}

// ubicación y fechas del reporte
export default function ReportFacts({ report }: ReportFactsProps) {
  return (
    <dl className='mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2'>
      <div className='flex gap-3'>
        <PinIcon className='mt-0.5 h-5 w-5 shrink-0 text-ink-muted' />
        <div className='min-w-0'>
          <dt className='text-sm text-ink-muted'>Ubicación</dt>
          <dd className='break-words font-bold text-ink'>
            {report.locationAddress || 'Ubicación desconocida'}
          </dd>
          {report.location && (
            <dd className='tabular text-sm text-ink-muted'>
              {report.location.lat.toFixed(4)}, {report.location.lng.toFixed(4)}
            </dd>
          )}
        </div>
      </div>

      <div className='flex gap-3'>
        <CalendarIcon className='mt-0.5 h-5 w-5 shrink-0 text-ink-muted' />
        <div>
          <dt className='text-sm text-ink-muted'>Fecha</dt>
          <dd className='font-bold text-ink'>{formatLongDate(report.createdAt)}</dd>
          {report.eventDate && (
            <dd className='text-sm text-ink-muted'>Suceso: {formatLongDay(report.eventDate)}</dd>
          )}
          {report.publishedAt && (
            <dd className='text-sm text-ink-muted'>Publicado: {formatLongDate(report.publishedAt)}</dd>
          )}
        </div>
      </div>
    </dl>
  )
}
