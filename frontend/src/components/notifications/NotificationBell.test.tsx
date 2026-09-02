import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationBell from '@/components/notifications/NotificationBell'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as notificationsService from '@/services/notifications.service'
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

function renderBell() {
  const { Wrapper } = createQueryWrapper()
  return render(<NotificationBell />, { wrapper: Wrapper })
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra la cantidad de no leidas en el badge', async () => {
    vi.mocked(notificationsService.listNotifications).mockResolvedValue([
      notificacion({ id: 1 }),
      notificacion({ id: 2 }),
      notificacion({ id: 3, isRead: true }),
    ])

    renderBell()

    expect(await screen.findByLabelText('2 notificaciones sin leer')).toHaveTextContent('2')
  })

  it('no muestra badge si esta todo leido', async () => {
    vi.mocked(notificationsService.listNotifications).mockResolvedValue([
      notificacion({ isRead: true }),
    ])

    renderBell()

    await waitFor(() => expect(notificationsService.listNotifications).toHaveBeenCalled())
    expect(screen.queryByLabelText(/notificaciones sin leer/)).not.toBeInTheDocument()
  })

  it('abre el panel y lista las notificaciones', async () => {
    const user = userEvent.setup()
    vi.mocked(notificationsService.listNotifications).mockResolvedValue([
      notificacion({ title: 'Posible coincidencia' }),
    ])

    renderBell()
    await user.click(await screen.findByRole('button', { name: 'Notificaciones' }))

    expect(screen.getByText('Posible coincidencia')).toBeInTheDocument()
  })

  it('marcar como leida actualiza el badge', async () => {
    const user = userEvent.setup()
    const sinLeer = notificacion({ id: 5 })
    vi.mocked(notificationsService.listNotifications).mockResolvedValue([sinLeer])
    vi.mocked(notificationsService.markNotificationAsRead).mockResolvedValue({
      ...sinLeer,
      isRead: true,
    })

    renderBell()
    await user.click(await screen.findByRole('button', { name: 'Notificaciones' }))
    expect(await screen.findByLabelText('1 notificaciones sin leer')).toBeInTheDocument()

    vi.mocked(notificationsService.listNotifications).mockResolvedValue([
      { ...sinLeer, isRead: true },
    ])
    await user.click(screen.getByRole('button', { name: 'Marcar como leída' }))

    await waitFor(() =>
      expect(screen.queryByLabelText(/notificaciones sin leer/)).not.toBeInTheDocument()
    )
    expect(notificationsService.markNotificationAsRead).toHaveBeenCalledWith(5)
  })

  it('elimina una notificacion desde el panel', async () => {
    const user = userEvent.setup()
    vi.mocked(notificationsService.listNotifications).mockResolvedValue([notificacion({ id: 8 })])
    vi.mocked(notificationsService.deleteNotification).mockResolvedValue(undefined)

    renderBell()
    await user.click(await screen.findByRole('button', { name: 'Notificaciones' }))

    vi.mocked(notificationsService.listNotifications).mockResolvedValue([])
    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    await waitFor(() => expect(notificationsService.deleteNotification).toHaveBeenCalledWith(8))
    expect(await screen.findByText('No tenés notificaciones')).toBeInTheDocument()
  })

  it('cierra el panel al volver a clickear', async () => {
    const user = userEvent.setup()
    vi.mocked(notificationsService.listNotifications).mockResolvedValue([
      notificacion({ title: 'Posible coincidencia' }),
    ])

    renderBell()
    const boton = await screen.findByRole('button', { name: 'Notificaciones' })
    await user.click(boton)
    await user.click(boton)

    expect(screen.queryByText('Posible coincidencia')).not.toBeInTheDocument()
  })
})
