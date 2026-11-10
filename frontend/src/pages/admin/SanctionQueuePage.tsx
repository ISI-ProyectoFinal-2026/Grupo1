import { useState } from 'react'
import SanctionDecisionDialog, { DELETE_ACCOUNT_LABEL } from '@/components/admin/SanctionDecisionDialog'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { useDecideSanction, usePendingSanctions } from '@/hooks/useAdminSanctions'
import { useIsModerator } from '@/hooks/useIsModerator'
import { formatLongDate } from '@/lib/format'
import { getApiErrorCode } from '@/services/api'
import { ROLE_LABELS, type SanctionQueueItem } from '@/types/admin.types'

const ERROR_BY_CODE: Record<string, string> = {
  SANCTION_ALREADY_DECIDED: 'Otra persona del equipo ya decidió este caso.',
  LAST_ADMIN: 'No se puede sancionar al último administrador activo.',
  SELF_SANCTION_DECISION: 'No podés decidir sobre tu propia sanción.',
}

// provisional vigente: confirmar elimina la cuenta
const deletesAccount = (item: SanctionQueueItem) => item.status === 'active' && item.kind === 'provisional'

function caseLabel(item: SanctionQueueItem): string {
  if (item.kind === 'temporary') return 'Suspensión temporal'
  if (!deletesAccount(item)) return 'Suspensión provisional (pendiente de confirmar)'
  const cause = item.recidivism ? 'Reincidencia' : 'Denuncias graves'
  return `${cause}: suspensión provisional, eliminación de la cuenta pendiente`
}

const SEVERITY_COUNT_LABELS = { mild: 'Leves', moderate: 'Medias', severe: 'Fuertes' } as const

const accountName = (item: SanctionQueueItem) => item.account.fullName ?? item.account.email

function SanctionQueuePage() {
  const isModerator = useIsModerator()
  const queue = usePendingSanctions(isModerator)
  const decide = useDecideSanction()
  const [pending, setPending] = useState<{
    item: SanctionQueueItem
    action: 'confirm' | 'revert'
  } | null>(null)

  if (!isModerator) return null

  async function submit(reason: string) {
    if (!pending) return
    try {
      await decide.mutateAsync({ id: pending.item.id, action: pending.action, reason })
    } catch {
      // el error se muestra desde decide.error
    }
    setPending(null)
  }

  function openDialog(item: SanctionQueueItem, action: 'confirm' | 'revert') {
    decide.reset()
    setPending({ item, action })
  }

  function renderBody() {
    if (queue.isError) {
      return (
        <div className='flex flex-col items-start gap-3'>
          <ErrorMessage message={queue.error.message} />
          <Button variant='secondary' onClick={() => queue.refetch()}>
            Reintentar
          </Button>
        </div>
      )
    }
    if (!queue.data) {
      return (
        <SkeletonGroup className='flex flex-col gap-2'>
          <Skeleton className='h-24' />
          <Skeleton className='h-24' />
        </SkeletonGroup>
      )
    }
    if (queue.data.items.length === 0) {
      return <EmptyState>No hay casos pendientes.</EmptyState>
    }
    return (
      <ul className='flex flex-col gap-3'>
        {queue.data.items.map((item) => (
          <li key={item.id} className='rounded-card border border-line p-4'>
            <p className='font-bold'>{item.account.fullName ?? 'Sin nombre'}</p>
            <p className='text-ink-muted'>{item.account.email}</p>
            <p className='mt-1 text-sm text-ink-muted'>
              {ROLE_LABELS[item.role]} · {caseLabel(item)}
            </p>
            <ul className='mt-2 flex flex-wrap gap-x-4 text-sm'>
              {(
                Object.keys(SEVERITY_COUNT_LABELS) as Array<keyof typeof SEVERITY_COUNT_LABELS>
              ).map((severity) => (
                <li key={severity}>
                  {SEVERITY_COUNT_LABELS[severity]}: {item.severityCounts[severity]}
                </li>
              ))}
            </ul>
            <p className='mt-2 text-sm text-ink-muted'>
              Denuncias: {item.reportDates.map((date) => formatLongDate(date)).join(', ')}
            </p>
            <div className='mt-3 flex gap-2'>
              <Button variant='danger' onClick={() => openDialog(item, 'confirm')}>
                {deletesAccount(item) ? DELETE_ACCOUNT_LABEL : 'Confirmar sanción'}
              </Button>
              <Button variant='secondary' onClick={() => openDialog(item, 'revert')}>
                Revertir
              </Button>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className='px-4 py-5 sm:px-6 lg:py-8'>
      <div className='mx-auto max-w-4xl'>
        <h1 className='font-display text-display-lg'>Sanciones pendientes</h1>

        {decide.isError && (
          <ErrorMessage
            className='mt-4'
            message={ERROR_BY_CODE[getApiErrorCode(decide.error) ?? ''] ?? decide.error.message}
          />
        )}

        <div className='mt-6'>{renderBody()}</div>
      </div>

      {pending && (
        <SanctionDecisionDialog
          action={pending.action}
          deletesAccount={deletesAccount(pending.item)}
          accountName={accountName(pending.item)}
          isLoading={decide.isPending}
          onSubmit={submit}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

export default SanctionQueuePage
