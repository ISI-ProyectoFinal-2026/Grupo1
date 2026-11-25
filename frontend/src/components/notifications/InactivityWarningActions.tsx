import { cn } from '@/lib/cn'
import { useInactivityWarningActions } from '@/hooks/useInactivityWarningActions'

interface InactivityWarningActionsProps {
  reportId: number
  isRead: boolean
  onAction?: () => void
}

const buttonClasses =
  'press inline-flex min-h-11 items-center rounded-control px-3 text-sm font-bold disabled:opacity-50'

function InactivityWarningActions({ reportId, isRead, onAction }: InactivityWarningActionsProps) {
  const actions = useInactivityWarningActions(reportId)
  const { isPending, done, succeeded, error } = actions
  const close = () => {
    onAction?.()
    actions.close()
  }
  const keep = () => {
    onAction?.()
    actions.keep()
  }

  return (
    <div className='mt-2'>
      {!done && !isRead && (
        <>
          <div
            role='group'
            aria-label='¿Querés seguir mostrando tu reporte?'
            className='mt-1 flex flex-wrap gap-2'
          >
            <button
              type='button'
              onClick={close}
              disabled={isPending}
              className={cn(buttonClasses, 'bg-surface text-ink ring-1 ring-line hover:bg-ink/5')}
            >
              Caso resuelto
            </button>
            <button
              type='button'
              onClick={keep}
              disabled={isPending}
              className={cn(buttonClasses, 'bg-signal text-ink hover:opacity-90')}
            >
              Seguir mostrando
            </button>
          </div>
        </>
      )}
      {succeeded && (
        <p role='status' className='text-sm text-ink-muted'>
          {succeeded === 'closed' ? 'Cerraste el reporte.' : 'Tu reporte sigue publicado.'}
        </p>
      )}
      {error && (
        <p role='alert' className='mt-1 text-sm text-danger'>
          {error}
        </p>
      )}
    </div>
  )
}

export default InactivityWarningActions
