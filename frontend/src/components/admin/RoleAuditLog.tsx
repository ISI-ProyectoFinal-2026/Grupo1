import { useState } from 'react'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { useRoleAudit } from '@/hooks/useAdminUsers'
import { ROLE_LABELS, type AuditPerson } from '@/types/admin.types'

const PAGE_SIZE = 10

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const personLabel = (person: AuditPerson) => person.fullName ?? person.email

function RoleAuditLog() {
  const [page, setPage] = useState(1)
  const audit = useRoleAudit({ page, pageSize: PAGE_SIZE })

  const totalPages = Math.max(1, Math.ceil((audit.data?.total ?? 0) / PAGE_SIZE))

  function renderBody() {
    if (audit.isError) {
      return (
        <div className='flex flex-col items-start gap-3'>
          <ErrorMessage message={audit.error.message} />
          <Button variant='secondary' onClick={() => audit.refetch()}>
            Reintentar
          </Button>
        </div>
      )
    }
    if (!audit.data) {
      return (
        <SkeletonGroup className='flex flex-col gap-2'>
          <Skeleton className='h-12' />
          <Skeleton className='h-12' />
        </SkeletonGroup>
      )
    }
    if (audit.data.items.length === 0) {
      return <EmptyState>Todavía no hay cambios de rol.</EmptyState>
    }
    return (
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[36rem] text-left'>
          <thead>
            <tr className='text-sm text-ink-muted'>
              <th scope='col' className='py-2 pr-4 font-bold'>
                Fecha
              </th>
              <th scope='col' className='py-2 pr-4 font-bold'>
                Administrador
              </th>
              <th scope='col' className='py-2 pr-4 font-bold'>
                Usuario
              </th>
              <th scope='col' className='py-2 font-bold'>
                Cambio
              </th>
            </tr>
          </thead>
          <tbody>
            {audit.data.items.map((entry) => (
              <tr key={entry.id} className='border-t border-line'>
                <td className='tabular py-2 pr-4 text-ink-muted'>
                  <time dateTime={entry.createdAt}>
                    {dateFormat.format(new Date(entry.createdAt))}
                  </time>
                </td>
                <td className='py-2 pr-4'>{personLabel(entry.actor)}</td>
                <td className='py-2 pr-4 font-bold'>{personLabel(entry.target)}</td>
                <td className='py-2'>
                  <span className='text-ink-muted'>{ROLE_LABELS[entry.previousRole]}</span>
                  <span aria-hidden='true' className='mx-2 text-ink-muted'>
                    →
                  </span>
                  <span className='sr-only'> a </span>
                  <span className='font-bold'>{ROLE_LABELS[entry.newRole]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <section aria-labelledby='role-audit-title' className='mt-10'>
      <h2 id='role-audit-title' className='font-display text-display-sm text-ink'>
        Registro de cambios de rol
      </h2>
      <div className='mt-4'>{renderBody()}</div>

      {audit.data && audit.data.total > PAGE_SIZE && (
        <nav
          aria-label='Paginación del registro'
          className='mt-6 flex items-center justify-between gap-3'
        >
          <Button variant='secondary' disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className='text-ink-muted'>
            Página {page} de {totalPages}
          </span>
          <Button
            variant='secondary'
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </nav>
      )}
    </section>
  )
}

export default RoleAuditLog
