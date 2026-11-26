import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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
    chatId: null,
    isRead: false,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

// contador del badge y lista del panel salen de endpoints distintos (#338)
function mockServidor(lista: NotificationDTO[]) {
  vi.mocked(notificationsService.listNotifications).mockResolvedValue({ items: lista, nextCursor: null })
  vi.mocked(notificationsService.getUnreadNotificationsCount).mockResolvedValue(
    lista.filter((n) => !n.isRead).length
  )
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
    mockServidor([
      notificacion({ id: 1 }),
      notificacion({ id: 2 }),
      notificacion({ id: 3, isRead: true }),
    ])

    renderBell()

    expect(await screen.findByLabelText('2 notificaciones sin leer')).toHaveTextContent('2')
  })

  it('no muestra badge si esta todo leido', async () => {
    mockServidor([
      notificacion({ isRead: true }),
    ])

    renderBell()

    await waitFor(() => expect(notificationsService.getUnreadNotificationsCount).toHaveBeenCalled())
    expect(screen.queryByLabelText(/notificaciones sin leer/)).not.toBeInTheDocument()
  })

  it('con el panel cerrado no pide la lista, solo el contador (#338)', async () => {
    mockServidor([notificacion()])

    renderBell()

    expect(await screen.findByLabelText('1 notificaciones sin leer')).toBeInTheDocument()
    expect(notificationsService.listNotifications).not.toHaveBeenCalled()
  })

  it('carga mas notificaciones con Ver más', async () => {
    const user = userEvent.setup()
    vi.mocked(notificationsService.getUnreadNotificationsCount).mockResolvedValue(0)
    vi.mocked(notificationsService.listNotifications)
      .mockResolvedValueOnce({ items: [notificacion({ id: 2, title: 'Pagina uno' })], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [notificacion({ id: 1, title: 'Pagina dos' })], nextCursor: null })

    renderBell()
    await user.click(await screen.findByRole('button', { name: 'Notificaciones' }))
    await user.click(await screen.findByRole('button', { name: 'Ver más' }))

    expect(await screen.findByText('Pagina dos')).toBeInTheDocument()
    expect(screen.getByText('Pagina uno')).toBeInTheDocument()
    expect(notificationsService.listNotifications).toHaveBeenLastCalledWith('c1')
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument()
  })

  it('abre el panel y lista las notificaciones', async () => {
    const user = userEvent.setup()
    mockServidor([
      notificacion({ title: 'Posible coincidencia' }),
    ])

    renderBell()
    await user.click(await screen.findByRole('button', { name: 'Notificaciones' }))

    expect(await screen.findByText('Posible coincidencia')).toBeInTheDocument()
  })

  it('marcar como leida actualiza el badge', async () => {
    const user = userEvent.setup()
    const sinLeer = notificacion({ id: 5 })
    mockServidor([sinLeer])
    vi.mocked(notificationsService.markNotificationAsRead).mockResolvedValue({
      ...sinLeer,
      isRead: true,
    })

    renderBell()
    await user.click(await screen.findByRole('button', { name: 'Notificaciones' }))
    expect(await screen.findByLabelText('1 notificaciones sin leer')).toBeInTheDocument()

    mockServidor([
      { ...sinLeer, isRead: true },
    ])
    await user.click(await screen.findByRole('button', { name: 'Marcar como leída' }))

    await waitFor(() =>
      expect(screen.queryByLabelText(/notificaciones sin leer/)).not.toBeInTheDocument()
    )
    expect(notificationsService.markNotificationAsRead).toHaveBeenCalledWith(5)
  })

  it('elimina una notificacion desde el panel', async () => {
    const user = userEvent.setup()
    mockServidor([notificacion({ id: 8 })])
    vi.mocked(notificationsService.deleteNotification).mockResolvedValue(undefined)

    renderBell()
    await user.click(await screen.findByRole('button', { name: 'Notificaciones' }))

    mockServidor([])
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))

    await waitFor(() => expect(notificationsService.deleteNotification).toHaveBeenCalledWith(8))
    expect(await screen.findByText('No tenés notificaciones')).toBeInTheDocument()
  })

  it('cierra el panel al volver a clickear', async () => {
    const user = userEvent.setup()
    mockServidor([
      notificacion({ title: 'Posible coincidencia' }),
    ])

    renderBell()
    const boton = await screen.findByRole('button', { name: 'Notificaciones' })
    await user.click(boton)
    await user.click(boton)

    expect(screen.queryByText('Posible coincidencia')).not.toBeInTheDocument()
  })

  it('abrir una notificacion con reporte navega, la marca como leida y cierra el panel (#222)', async () => {
    const user = userEvent.setup()
    const coincidencia = notificacion({
      id: 12,
      type: 'match_suggested',
      title: 'Posible coincidencia',
      reportId: 30,
    })
    mockServidor([coincidencia])
    vi.mocked(notificationsService.markNotificationAsRead).mockResolvedValue({
      ...coincidencia,
      isRead: true,
    })

    const { Wrapper } = createQueryWrapper()
    render(
      <MemoryRouter initialEntries={['/']}>
        <NotificationBell />
        <Routes>
          <Route path='/' element={null} />
          <Route path='/reports/:id' element={<p>Detalle del reporte</p>} />
        </Routes>
      </MemoryRouter>,
      { wrapper: Wrapper }
    )
    await user.click(await screen.findByRole('button', { name: 'Notificaciones' }))
    await user.click(await screen.findByRole('link', { name: /Posible coincidencia/ }))

    expect(screen.getByText('Detalle del reporte')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Posible coincidencia/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(notificationsService.markNotificationAsRead).toHaveBeenCalledWith(12))
  })
})
