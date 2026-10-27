import { useNavigate } from 'react-router-dom'
import { useSimilarReportsQuery } from '@/hooks/useSimilarReportsQuery'
import type { ReportLocation, ReportType, SimilarReportDTO } from '@/types/report.types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { PawIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

interface SimilarReportsSuggestionsProps {
  reportType: ReportType
  location: ReportLocation | undefined
  imageUrl: string | undefined
}

// mismo verde que "Coincidencia confirmada" en MatchCard (contraste AA)
const RESOLVED_COLOR = '#176B47'

function formatDistance(meters: number): string {
  if (meters < 1000) return `a ${meters} m`
  return `a ${(meters / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km`
}

function SuggestionItem({
  report,
  onSelect,
}: {
  report: SimilarReportDTO
  onSelect: (id: number) => void
}) {
  return (
    <li className='card flex flex-col gap-3 p-3 sm:flex-row sm:items-center'>
      <div className='flex min-w-0 flex-1 gap-3'>
        {report.imageUrl ? (
          <img
            src={report.imageUrl}
            alt={report.title}
            width={64}
            height={64}
            loading='lazy'
            className='h-16 w-16 shrink-0 rounded-[10px] object-cover'
          />
        ) : (
          <div className='grid h-16 w-16 shrink-0 place-items-center rounded-[10px] bg-surface text-ink-muted'>
            <PawIcon className='h-7 w-7' strokeWidth={1.5} />
          </div>
        )}
        <div className='flex min-w-0 flex-col gap-1'>
          <p className='line-clamp-2 break-words font-bold leading-snug text-ink'>{report.title}</p>
          <p className='tabular text-sm text-ink-muted'>{formatDistance(report.distanceMeters)}</p>
          <div className='flex flex-wrap items-center gap-1.5'>
            {report.similarity !== null && (
              <span className='tabular text-sm font-bold text-ink'>
                {Math.max(0, Math.round(report.similarity * 100))} % de similitud
              </span>
            )}
            {report.status === 'resolved' && (
              <Badge label='Resuelto' backgroundColor={RESOLVED_COLOR} />
            )}
          </div>
        </div>
      </div>
      <Button
        variant='secondary'
        size='sm'
        className='w-full flex-col gap-0 sm:w-auto'
        onClick={() => onSelect(report.id)}
      >
        <span>Sí, es este</span>
        <span className='text-xs font-normal'>
          {report.isOwn ? 'Ver mi reporte' : 'Contactar al autor'}
        </span>
      </Button>
    </li>
  )
}

// Sugerencias opcionales: sin resultados o ante un error no se muestra nada.
export default function SimilarReportsSuggestions({
  reportType,
  location,
  imageUrl,
}: SimilarReportsSuggestionsProps) {
  const navigate = useNavigate()
  const { data, isPlaceholderData } = useSimilarReportsQuery(reportType, location, imageUrl)

  if (!location || !data || data.length === 0) return null

  return (
    <section
      aria-labelledby='similar-reports-title'
      className='flex flex-col gap-2'
      aria-busy={isPlaceholderData}
    >
      <h3 id='similar-reports-title' className='font-bold text-ink'>
        ¿Alguno de estos coincide con tu avistamiento?
      </h3>
      <p className='text-sm text-ink-muted'>
        Si es el mismo caso, abrilo en lugar de crear otro reporte.
      </p>
      <ul className={cn('flex flex-col gap-2', isPlaceholderData && 'opacity-60')}>
        {data.map((report) => (
          <SuggestionItem
            key={report.id}
            report={report}
            onSelect={(id) => navigate(`/reports/${id}`)}
          />
        ))}
      </ul>
    </section>
  )
}
