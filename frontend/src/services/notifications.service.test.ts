import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import {
  deleteNotification,
  listNotifications,
  markNotificationAsRead,
} from '@/services/notifications.service'
import type { NotificationDTO } from '@/types/notification.types'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

function notificacion(overrides: Partial<NotificationDTO> = {}): NotificationDTO {
  return {
    id: 1,
    userId: 7,
    type: 'message',
    title: 'Nuevo mensaje',
    message: 'Tenes un mensaje nuevo',
    reportId: null,
    isRead: false,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('notifications.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista las notificaciones desde /notifications', async () => {
    const esperadas = [notificacion(), notificacion({ id: 2, isRead: true })]
    vi.mocked(api.get).mockResolvedValue(respuesta(esperadas))

    const resultado = await listNotifications()

    expect(api.get).toHaveBeenCalledWith('/notifications')
    expect(resultado).toEqual(esperadas)
  })

  it('marca como leida contra /notifications/:id/read', async () => {
    const leida = notificacion({ isRead: true })
    vi.mocked(api.put).mockResolvedValue(respuesta(leida))

    const resultado = await markNotificationAsRead(1)

    expect(api.put).toHaveBeenCalledWith('/notifications/1/read')
    expect(resultado.isRead).toBe(true)
  })

  it('elimina contra /notifications/:id y no devuelve cuerpo', async () => {
    vi.mocked(api.delete).mockResolvedValue(respuesta(undefined))

    const resultado = await deleteNotification(5)

    expect(api.delete).toHaveBeenCalledWith('/notifications/5')
    expect(resultado).toBeUndefined()
  })
})
