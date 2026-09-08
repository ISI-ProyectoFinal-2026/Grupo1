import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteNotification,
  listNotifications,
  markNotificationAsRead,
} from '@/services/notifications.service'
import type { NotificationDTO } from '@/types/notification.types'

export const notificationsQueryKey = ['notifications'] as const

// el backend no emite evento de socket para notificaciones: el tiempo real va por polling
export const NOTIFICATIONS_POLL_INTERVAL_MS = 30000

export function countUnread(notifications: NotificationDTO[] | undefined): number {
  return notifications?.filter((notification) => !notification.isRead).length ?? 0
}

export function useNotificationsQuery(enabled = true) {
  return useQuery({
    queryKey: notificationsQueryKey,
    queryFn: listNotifications,
    enabled,
    refetchInterval: enabled ? NOTIFICATIONS_POLL_INTERVAL_MS : false,
  })
}

function useInvalidateNotifications() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
}

export function useMarkNotificationAsRead() {
  const invalidate = useInvalidateNotifications()
  return useMutation({
    mutationFn: (id: number) => markNotificationAsRead(id),
    onSuccess: invalidate,
  })
}

export function useDeleteNotification() {
  const invalidate = useInvalidateNotifications()
  return useMutation({
    mutationFn: (id: number) => deleteNotification(id),
    onSuccess: invalidate,
  })
}
