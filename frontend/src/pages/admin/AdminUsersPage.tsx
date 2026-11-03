import { useState } from 'react'
import ConfirmRoleChangeDialog from '@/components/admin/ConfirmRoleChangeDialog'
import RoleAuditLog from '@/components/admin/RoleAuditLog'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import ErrorMessage from '@/components/ui/ErrorMessage'
import Input from '@/components/ui/Input'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
import { useAdminUsers, useChangeUserRole } from '@/hooks/useAdminUsers'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getApiErrorCode } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'
import { ROLE_LABELS, type AdminUser } from '@/types/admin.types'
import type { Role } from '@/types/auth'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300
const ROLES = Object.keys(ROLE_LABELS) as Role[]

const ERROR_BY_CODE: Record<string, string> = {
  SELF_ROLE_CHANGE: 'No podés cambiar tu propio rol.',
  ROLE_UNCHANGED: 'El usuario ya tiene ese rol.',
  LAST_ADMIN: 'No se puede dejar al sistema sin administradores.',
}

const userLabel = (user: AdminUser) => user.fullName ?? user.email

function AdminUsersPage() {
  const myId = useAuthStore((state) => state.user?.id)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState<{ user: AdminUser; role: Role } | null>(null)
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS)

  const users = useAdminUsers({ q, role, page, pageSize: PAGE_SIZE })
  const changeRole = useChangeUserRole()

  const totalPages = Math.max(1, Math.ceil((users.data?.total ?? 0) / PAGE_SIZE))

  async function confirmChange() {
    if (!pending) return
    try {
      await changeRole.mutateAsync({ id: pending.user.id, role: pending.role })
    } catch {
      // el error se muestra desde changeRole.error
    }
    setPending(null)
  }

  function renderBody() {
    if (users.isError) {
      return (
        <div className='flex flex-col items-start gap-3'>
          <ErrorMessage message={users.error.message} />
          <Button variant='secondary' onClick={() => users.refetch()}>
            Reintentar
          </Button>
        </div>
      )
    }
    if (!users.data) {
      return (
        <SkeletonGroup className='flex flex-col gap-2'>
          <Skeleton className='h-12' />
          <Skeleton className='h-12' />
          <Skeleton className='h-12' />
        </SkeletonGroup>
      )
    }
    if (users.data.items.length === 0) {
      return <EmptyState>No encontramos usuarios.</EmptyState>
    }
    return (
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[36rem] text-left'>
          <thead>
            <tr className='text-sm text-ink-muted'>
              <th scope='col' className='py-2 pr-4 font-bold'>
                Nombre
              </th>
              <th scope='col' className='py-2 pr-4 font-bold'>
                Email
              </th>
              <th scope='col' className='py-2 font-bold'>
                Rol
              </th>
            </tr>
          </thead>
          <tbody>
            {users.data.items.map((user) => (
              <tr key={user.id} className='border-t border-line'>
                <td className='py-2 pr-4 font-bold'>{user.fullName ?? 'Sin nombre'}</td>
                <td className='py-2 pr-4 text-ink-muted'>{user.email}</td>
                <td className='py-2'>
                  <select
                    aria-label={`Rol de ${userLabel(user)}`}
                    value={user.role}
                    disabled={user.id === myId || changeRole.isPending}
                    onChange={(event) => {
                      changeRole.reset()
                      setPending({ user, role: event.target.value as Role })
                    }}
                    className='field'
                  >
                    {ROLES.map((value) => (
                      <option key={value} value={value}>
                        {ROLE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className='px-4 py-5 sm:px-6 lg:py-8'>
      <div className='mx-auto max-w-4xl'>
        <h1 className='font-display text-display-lg'>Usuarios</h1>

        <div className='mt-6 grid gap-3 sm:grid-cols-[1fr_14rem]'>
          <Input
            name='user-search'
            label='Buscar por nombre o email'
            type='search'
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          <div className='flex flex-col gap-1.5'>
            <label htmlFor='role-filter' className='field-label'>
              Filtrar por rol
            </label>
            <select
              id='role-filter'
              value={role}
              onChange={(event) => {
                setRole(event.target.value as Role | '')
                setPage(1)
              }}
              className='field'
            >
              <option value=''>Todos</option>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {changeRole.isError && (
          <ErrorMessage
            className='mt-4'
            message={
              ERROR_BY_CODE[getApiErrorCode(changeRole.error) ?? ''] ?? changeRole.error.message
            }
          />
        )}

        <div className='mt-6'>{renderBody()}</div>

        {users.data && users.data.total > 0 && (
          <nav aria-label='Paginación' className='mt-6 flex items-center justify-between gap-3'>
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

        <RoleAuditLog />
      </div>

      {pending && (
        <ConfirmRoleChangeDialog
          target={pending.user}
          newRole={pending.role}
          isLoading={changeRole.isPending}
          onConfirm={confirmChange}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}

export default AdminUsersPage
