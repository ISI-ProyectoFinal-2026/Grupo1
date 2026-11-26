import { api } from './api'
import type { NotificationDTO } from '@/types/notification.types'
import type { CursorPage } from '@/types/pagination.types'

// más nuevas primero; el cursor pide la página siguiente (#338)
export async function listNotifications(cursor?: string): Promise<CursorPage<NotificationDTO>> {
  const { data } = await api.get<CursorPage<NotificationDTO>>('/notifications', {
    params: cursor ? { cursor } : undefined,
  })
  return data
}

export async function getUnreadNotificationsCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/notifications/unread-count')
  return data.count
}

export async function markNotificationAsRead(id: number): Promise<NotificationDTO> {
  const { data } = await api.put<NotificationDTO>(`/notifications/${id}/read`)
  return data
}

// responde 204 sin cuerpo
export async function deleteNotification(id: number): Promise<void> {
  await api.delete(`/notifications/${id}`)
}
