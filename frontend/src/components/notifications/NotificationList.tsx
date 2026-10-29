import { useState } from 'react'
import { BellIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { NotificationDTO } from '@/types/notification.types'

const NOTIFICATIONS_PAGE_SIZE = 5

interface NotificationListProps {
  notifications: NotificationDTO[]
  onMarkRead: (id: number) => void
  onDelete: (id: number) => void
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

const actionClasses =
  'press inline-flex min-h-11 items-center rounded-control px-2 text-sm font-bold hover:bg-surface'

function NotificationList({ notifications, onMarkRead, onDelete }: NotificationListProps) {
  const [page, setPage] = useState(0)

  const totalPages = Math.ceil(notifications.length / NOTIFICATIONS_PAGE_SIZE)
  // el paginado es en cliente: el backend devuelve la lista completa
  const currentPage = Math.min(page, Math.max(totalPages - 1, 0))
  const start = currentPage * NOTIFICATIONS_PAGE_SIZE
  const visible = notifications.slice(start, start + NOTIFICATIONS_PAGE_SIZE)

  if (notifications.length === 0) {
    return (
      <div className='flex flex-col items-center gap-3 px-4 py-10 text-center'>
        <span className='grid h-12 w-12 place-items-center rounded-full bg-surface text-ink-muted ring-1 ring-line'>
          <BellIcon className='h-6 w-6' />
        </span>
        <p className='text-sm text-ink-muted'>No tenés notificaciones</p>
      </div>
    )
  }

  return (
    <div>
      <ul className='divide-y divide-line'>
        {visible.map((notification) => (
          <li
            key={notification.id}
            className={cn(
              'relative px-4 py-3',
              !notification.isRead && 'bg-signal/10 before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:bg-signal'
            )}
          >
            <p className='font-bold text-ink'>{notification.title}</p>
            {notification.message && (
              <p className='mt-0.5 break-words text-sm text-ink-muted'>{notification.message}</p>
            )}
            <div className='mt-1 flex flex-wrap items-center gap-x-1'>
              <time className='mr-auto text-xs text-ink-muted' dateTime={notification.createdAt}>
                {formatDate(notification.createdAt)}
              </time>
              {!notification.isRead && (
                <button
                  type='button'
                  onClick={() => onMarkRead(notification.id)}
                  className={cn(actionClasses, 'text-ink')}
                >
                  Marcar como leída
                </button>
              )}
              <button
                type='button'
                onClick={() => onDelete(notification.id)}
                className={cn(actionClasses, 'text-ink-muted hover:text-danger')}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className='flex items-center justify-between border-t border-line px-2 py-1'>
          <button
            type='button'
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 0}
            className={cn(actionClasses, 'text-ink disabled:text-ink-muted/50 disabled:hover:bg-transparent')}
          >
            Anterior
          </button>
          <span className='tabular text-sm text-ink-muted'>
            {currentPage + 1} de {totalPages}
          </span>
          <button
            type='button'
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className={cn(actionClasses, 'text-ink disabled:text-ink-muted/50 disabled:hover:bg-transparent')}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

export default NotificationList
