import { useState } from 'react'
import NotificationList from '@/components/notifications/NotificationList'
import { BellIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
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
    <div
      className='relative'
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type='button'
        aria-label='Notificaciones'
        aria-expanded={open}
        aria-controls='panel-notificaciones'
        onClick={() => setOpen((previous) => !previous)}
        className={cn(
          'relative grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5',
          open && 'bg-ink/5'
        )}
      >
        <BellIcon className='h-[22px] w-[22px]' />
        {unread > 0 && (
          <span
            aria-label={`${unread} notificaciones sin leer`}
            className='tabular absolute right-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-white ring-2 ring-paper'
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id='panel-notificaciones'
          className={cn(
            'fixed inset-x-3 top-[calc(var(--header-h)+0.5rem)] z-40 max-h-[70vh] overflow-y-auto overscroll-contain rounded-card border border-line bg-paper shadow-pop',
            'sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96',
            'lg:left-0 lg:right-auto'
          )}
        >
          <h2 className='border-b border-line px-4 py-3 font-display text-display-sm'>Notificaciones</h2>
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
