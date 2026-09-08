import { api } from './api'
import type { NotificationDTO } from '@/types/notification.types'

// el backend devuelve todo, sin paginado
export async function listNotifications(): Promise<NotificationDTO[]> {
  const { data } = await api.get<NotificationDTO[]>('/notifications')
  return data
}

export async function markNotificationAsRead(id: number): Promise<NotificationDTO> {
  const { data } = await api.put<NotificationDTO>(`/notifications/${id}/read`)
  return data
}

// responde 204 sin cuerpo
export async function deleteNotification(id: number): Promise<void> {
  await api.delete(`/notifications/${id}`)
}
