import { useState } from 'react'
import type { NotificationDTO } from '@/types/notification.types'

export const NOTIFICATIONS_PAGE_SIZE = 5

interface NotificationListProps {
  notifications: NotificationDTO[]
  onMarkRead: (id: number) => void
  onDelete: (id: number) => void
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function NotificationList({ notifications, onMarkRead, onDelete }: NotificationListProps) {
  const [page, setPage] = useState(0)

  const totalPages = Math.ceil(notifications.length / NOTIFICATIONS_PAGE_SIZE)
  // el paginado es en cliente: el backend devuelve la lista completa
  const currentPage = Math.min(page, Math.max(totalPages - 1, 0))
  const start = currentPage * NOTIFICATIONS_PAGE_SIZE
  const visible = notifications.slice(start, start + NOTIFICATIONS_PAGE_SIZE)

  if (notifications.length === 0) {
    return <p className='px-4 py-6 text-center text-sm text-gray-500'>No tenés notificaciones</p>
  }

  return (
    <div>
      <ul className='divide-y divide-gray-100'>
        {visible.map((notification) => (
          <li
            key={notification.id}
            className={`px-4 py-3 ${notification.isRead ? 'bg-white' : 'bg-blue-50'}`}
          >
            <p className='text-sm font-medium text-gray-900'>{notification.title}</p>
            {notification.message && (
              <p className='mt-0.5 text-sm text-gray-600'>{notification.message}</p>
            )}
            <div className='mt-1 flex items-center gap-3'>
              <time className='text-xs text-gray-400' dateTime={notification.createdAt}>
                {formatDate(notification.createdAt)}
              </time>
              {!notification.isRead && (
                <button
                  type='button'
                  onClick={() => onMarkRead(notification.id)}
                  className='text-xs text-blue-600 hover:underline'
                >
                  Marcar como leída
                </button>
              )}
              <button
                type='button'
                onClick={() => onDelete(notification.id)}
                className='text-xs text-gray-500 hover:underline'
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className='flex items-center justify-between border-t border-gray-100 px-4 py-2'>
          <button
            type='button'
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 0}
            className='text-xs text-gray-600 disabled:text-gray-300'
          >
            Anterior
          </button>
          <span className='text-xs text-gray-400'>
            {currentPage + 1} de {totalPages}
          </span>
          <button
            type='button'
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className='text-xs text-gray-600 disabled:text-gray-300'
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

export default NotificationList
