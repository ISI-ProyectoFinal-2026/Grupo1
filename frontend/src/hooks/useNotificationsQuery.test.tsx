import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as notificationsService from '@/services/notifications.service'
import {
  NOTIFICATIONS_POLL_INTERVAL_MS,
  useDeleteNotification,
  useMarkNotificationAsRead,
  useNotificationsQuery,
  useUnreadNotificationsCount,
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
    chatId: null,
    isRead: false,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('useUnreadNotificationsCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trae el contador de no leidas', async () => {
    vi.mocked(notificationsService.getUnreadNotificationsCount).mockResolvedValue(3)
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUnreadNotificationsCount(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data).toBe(3))
  })

  it('el polling consulta solo el contador, no la lista (#338)', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(notificationsService.getUnreadNotificationsCount).mockResolvedValue(1)
      const { Wrapper } = createQueryWrapper()

      const { result } = renderHook(() => useUnreadNotificationsCount(), { wrapper: Wrapper })
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(notificationsService.getUnreadNotificationsCount).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_INTERVAL_MS + 100)

      expect(notificationsService.getUnreadNotificationsCount).toHaveBeenCalledTimes(2)
      expect(notificationsService.listNotifications).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('no consulta si esta deshabilitado', () => {
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useUnreadNotificationsCount(false), { wrapper: Wrapper })

    expect(notificationsService.getUnreadNotificationsCount).not.toHaveBeenCalled()
  })
})

describe('useNotificationsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trae la primera pagina de notificaciones', async () => {
    const esperadas = [notificacion(), notificacion({ id: 2, isRead: true })]
    vi.mocked(notificationsService.listNotifications).mockResolvedValue({ items: esperadas, nextCursor: null })
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useNotificationsQuery(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(notificationsService.listNotifications).toHaveBeenCalledWith(undefined)
    expect(result.current.data).toEqual(esperadas)
    expect(result.current.hasNextPage).toBe(false)
  })

  it('pide la pagina siguiente con el cursor y concatena', async () => {
    vi.mocked(notificationsService.listNotifications)
      .mockResolvedValueOnce({ items: [notificacion({ id: 2 })], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [notificacion({ id: 1 })], nextCursor: null })
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useNotificationsQuery(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))

    await result.current.fetchNextPage()

    await waitFor(() => expect(result.current.data?.map((n) => n.id)).toEqual([2, 1]))
    expect(notificationsService.listNotifications).toHaveBeenLastCalledWith('c1')
    expect(result.current.hasNextPage).toBe(false)
  })

  it('no hace polling de la lista', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(notificationsService.listNotifications).mockResolvedValue({ items: [], nextCursor: null })
      const { Wrapper } = createQueryWrapper()

      const { result } = renderHook(() => useNotificationsQuery(), { wrapper: Wrapper })
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true))

      await vi.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_INTERVAL_MS + 100)

      expect(notificationsService.listNotifications).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('no consulta si esta deshabilitado', () => {
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useNotificationsQuery(false), { wrapper: Wrapper })

    expect(notificationsService.listNotifications).not.toHaveBeenCalled()
  })
})

describe('mutaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marcar como leida refresca la lista y el contador', async () => {
    const sinLeer = notificacion()
    vi.mocked(notificationsService.listNotifications).mockResolvedValue({ items: [sinLeer], nextCursor: null })
    vi.mocked(notificationsService.getUnreadNotificationsCount).mockResolvedValue(1)
    vi.mocked(notificationsService.markNotificationAsRead).mockResolvedValue({ ...sinLeer, isRead: true })
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(
      () => ({ lista: useNotificationsQuery(), contador: useUnreadNotificationsCount(), marcar: useMarkNotificationAsRead() }),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.contador.data).toBe(1))
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))

    vi.mocked(notificationsService.listNotifications).mockResolvedValue({
      items: [{ ...sinLeer, isRead: true }],
      nextCursor: null,
    })
    vi.mocked(notificationsService.getUnreadNotificationsCount).mockResolvedValue(0)
    result.current.marcar.mutate(sinLeer.id)

    await waitFor(() => expect(result.current.contador.data).toBe(0))
    await waitFor(() => expect(result.current.lista.data?.[0].isRead).toBe(true))
    expect(notificationsService.markNotificationAsRead).toHaveBeenCalledWith(sinLeer.id)
  })

  it('eliminar refresca la lista', async () => {
    const uno = notificacion()
    vi.mocked(notificationsService.listNotifications).mockResolvedValue({ items: [uno], nextCursor: null })
    vi.mocked(notificationsService.deleteNotification).mockResolvedValue(undefined)
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(
      () => ({ query: useNotificationsQuery(), borrar: useDeleteNotification() }),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))

    vi.mocked(notificationsService.listNotifications).mockResolvedValue({ items: [], nextCursor: null })
    result.current.borrar.mutate(uno.id)

    await waitFor(() => expect(result.current.query.data).toEqual([]))
    expect(notificationsService.deleteNotification).toHaveBeenCalledWith(uno.id)
  })
})
