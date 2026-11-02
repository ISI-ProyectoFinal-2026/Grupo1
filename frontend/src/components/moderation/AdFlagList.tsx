import { Link } from 'react-router-dom'
import EmptyState from '@/components/ui/EmptyState'
import { buttonClasses } from '@/components/ui/buttonClasses'
import type { AdFlagDTO } from '@/types/ad.types'

interface AdFlagListProps {
  flags: AdFlagDTO[]
  onResolve: (id: number, action: 'remove' | 'dismiss') => void
  // dar de baja cierra las demás denuncias del anuncio: se bloquean todas mientras tanto
  isResolving: boolean
}

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

// denuncias de anuncios: el moderador da de baja el anuncio o desestima (ADR-0024)
function AdFlagList({ flags, onResolve, isResolving }: AdFlagListProps) {
  if (flags.length === 0) {
    return (
      <EmptyState>
        <p className='text-ink-muted'>No hay anuncios pendientes de moderación</p>
      </EmptyState>
    )
  }

  return (
    <ul className='flex flex-col gap-3'>
      {flags.map((flag) => (
        <li key={flag.id} className='card flex flex-col gap-3 p-4'>
          <div className='flex gap-3'>
            <img src={flag.ad.imageUrl} alt='' className='aspect-video w-32 shrink-0 rounded-control border border-line object-cover' />
            <div className='min-w-0'>
              <p className='break-words font-display text-display-sm text-ink'>{flag.ad.title}</p>
              <p className='break-words text-sm text-ink'>{flag.ad.body}</p>
              <Link
                to={`/businesses/${flag.ad.business.id}`}
                className='text-sm font-bold text-ink-muted underline-offset-4 hover:underline'
              >
                {flag.ad.business.name}
              </Link>
            </div>
          </div>

          <p className='break-words border-l-4 border-line pl-3 text-ink'>{flag.reason}</p>

          <div className='flex flex-wrap items-center justify-between gap-3'>
            <time className='text-sm text-ink-muted' dateTime={flag.createdAt}>
              {dateFormat.format(new Date(flag.createdAt))}
            </time>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={() => onResolve(flag.id, 'dismiss')}
                disabled={isResolving}
                className={buttonClasses('secondary', 'sm')}
              >
                Desestimar
              </button>
              <button
                type='button'
                onClick={() => onResolve(flag.id, 'remove')}
                disabled={isResolving}
                className={buttonClasses('danger', 'sm')}
              >
                Dar de baja el anuncio
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default AdFlagList
