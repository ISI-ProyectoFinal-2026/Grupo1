import { useState } from 'react'
import NotificationList from '@/components/notifications/NotificationList'
import {
  countUnread,
  useDeleteNotification,
  useMarkNotificationAsRead,
  useNotificationsQuery,
} from '@/hooks/useNotificationsQuery'

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { data: notifications } = useNotificationsQuery()
  const markRead = useMarkNotificationAsRead()
  const remove = useDeleteNotification()

  const unread = countUnread(notifications)

  return (
    <div className='relative'>
      <button
        type='button'
        aria-label='Notificaciones'
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className='relative text-gray-600 hover:text-gray-900'
      >
        <span aria-hidden='true'>🔔</span>
        {unread > 0 && (
          <span
            aria-label={`${unread} notificaciones sin leer`}
            className='absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white'
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className='absolute right-0 z-10 mt-2 w-80 rounded-md border border-gray-200 bg-white shadow-lg'>
          <NotificationList
            notifications={notifications ?? []}
            onMarkRead={(id) => markRead.mutate(id)}
            onDelete={(id) => remove.mutate(id)}
          />
        </div>
      )}
    </div>
  )
}

export default NotificationBell
