import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as notificationsService from '@/services/notifications.service'
import {
  NOTIFICATIONS_POLL_INTERVAL_MS,
  countUnread,
  useDeleteNotification,
  useMarkNotificationAsRead,
  useNotificationsQuery,
} from '@/hooks/useNotificationsQuery'
import type { NotificationDTO } from '@/types/notification.types'

vi.mock('@/services/notifications.service')

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

describe('countUnread', () => {
  it('cuenta solo las no leidas', () => {
    const lista = [notificacion(), notificacion({ id: 2, isRead: true }), notificacion({ id: 3 })]
    expect(countUnread(lista)).toBe(2)
  })

  it('devuelve 0 si no hay datos', () => {
    expect(countUnread(undefined)).toBe(0)
    expect(countUnread([])).toBe(0)
  })
})

describe('useNotificationsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trae las notificaciones del usuario', async () => {
    const esperadas = [notificacion(), notificacion({ id: 2, isRead: true })]
    vi.mocked(notificationsService.listNotifications).mockResolvedValue(esperadas)
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useNotificationsQuery(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(esperadas)
  })

  it('vuelve a consultar sola pasado el intervalo de polling', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(notificationsService.listNotifications).mockResolvedValue([notificacion()])
      const { Wrapper } = createQueryWrapper()

      const { result } = renderHook(() => useNotificationsQuery(), { wrapper: Wrapper })
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(notificationsService.listNotifications).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_INTERVAL_MS + 100)

      expect(notificationsService.listNotifications).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('no consulta si esta deshabilitado', () => {
    vi.mocked(notificationsService.listNotifications).mockResolvedValue([])
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useNotificationsQuery(false), { wrapper: Wrapper })

    expect(notificationsService.listNotifications).not.toHaveBeenCalled()
  })
})

describe('mutaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marcar como leida refresca la lista', async () => {
    const sinLeer = notificacion()
    vi.mocked(notificationsService.listNotifications).mockResolvedValue([sinLeer])
    vi.mocked(notificationsService.markNotificationAsRead).mockResolvedValue({
      ...sinLeer,
      isRead: true,
    })
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(
      () => ({ query: useNotificationsQuery(), marcar: useMarkNotificationAsRead() }),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))

    vi.mocked(notificationsService.listNotifications).mockResolvedValue([
      { ...sinLeer, isRead: true },
    ])
    result.current.marcar.mutate(sinLeer.id)

    await waitFor(() => expect(countUnread(result.current.query.data)).toBe(0))
    expect(notificationsService.markNotificationAsRead).toHaveBeenCalledWith(sinLeer.id)
  })

  it('eliminar refresca la lista', async () => {
    const uno = notificacion()
    vi.mocked(notificationsService.listNotifications).mockResolvedValue([uno])
    vi.mocked(notificationsService.deleteNotification).mockResolvedValue(undefined)
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(
      () => ({ query: useNotificationsQuery(), borrar: useDeleteNotification() }),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))

    vi.mocked(notificationsService.listNotifications).mockResolvedValue([])
    result.current.borrar.mutate(uno.id)

    await waitFor(() => expect(result.current.query.data).toEqual([]))
    expect(notificationsService.deleteNotification).toHaveBeenCalledWith(uno.id)
  })
})
