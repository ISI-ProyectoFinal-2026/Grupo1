import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteNotification,
  getUnreadNotificationsCount,
  listNotifications,
  markNotificationAsRead,
} from '@/services/notifications.service'

const notificationsQueryKey = ['notifications'] as const
export const notificationsListQueryKey = [...notificationsQueryKey, 'list'] as const
export const unreadNotificationsCountQueryKey = [...notificationsQueryKey, 'unread-count'] as const

// el backend no emite evento de socket para notificaciones: el tiempo real va por polling
export const NOTIFICATIONS_POLL_INTERVAL_MS = 30000

// el polling consulta solo el contador (#338)
export function useUnreadNotificationsCount(enabled = true) {
  return useQuery({
    queryKey: unreadNotificationsCountQueryKey,
    queryFn: getUnreadNotificationsCount,
    enabled,
    refetchInterval: enabled ? NOTIFICATIONS_POLL_INTERVAL_MS : false,
  })
}

// lista paginada por cursor, sin polling
export function useNotificationsQuery(enabled = true) {
  return useInfiniteQuery({
    queryKey: notificationsListQueryKey,
    queryFn: ({ pageParam }) => listNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
    enabled,
  })
}

// refresca lista y contador
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
