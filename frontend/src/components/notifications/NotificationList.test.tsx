import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import NotificationList from '@/components/notifications/NotificationList'
import type { NotificationDTO } from '@/types/notification.types'

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

function muchas(cantidad: number): NotificationDTO[] {
  return Array.from({ length: cantidad }, (_, i) =>
    notificacion({ id: i + 1, title: `Notificacion ${i + 1}` })
  )
}

describe('NotificationList', () => {
  it('muestra un mensaje cuando no hay notificaciones', () => {
    render(<NotificationList notifications={[]} onMarkRead={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('No tenés notificaciones')).toBeInTheDocument()
  })

  it('muestra solo la primera pagina', () => {
    render(<NotificationList notifications={muchas(7)} onMarkRead={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText('Notificacion 1')).toBeInTheDocument()
    expect(screen.getByText('Notificacion 5')).toBeInTheDocument()
    expect(screen.queryByText('Notificacion 6')).not.toBeInTheDocument()
  })

  it('navega a la pagina siguiente', async () => {
    const user = userEvent.setup()
    render(<NotificationList notifications={muchas(7)} onMarkRead={vi.fn()} onDelete={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(screen.getByText('Notificacion 6')).toBeInTheDocument()
    expect(screen.queryByText('Notificacion 1')).not.toBeInTheDocument()
  })

  it('no pagina cuando entra todo en una pagina', () => {
    render(<NotificationList notifications={muchas(3)} onMarkRead={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
  })

  it('avisa cuando se marca una como leida', async () => {
    const user = userEvent.setup()
    const onMarkRead = vi.fn()
    render(
      <NotificationList
        notifications={[notificacion({ id: 42 })]}
        onMarkRead={onMarkRead}
        onDelete={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Marcar como leída' }))

    expect(onMarkRead).toHaveBeenCalledWith(42)
  })

  it('no ofrece marcar como leida una ya leida', () => {
    render(
      <NotificationList
        notifications={[notificacion({ isRead: true })]}
        onMarkRead={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: 'Marcar como leída' })).not.toBeInTheDocument()
  })

  it('avisa cuando se elimina una', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <NotificationList
        notifications={[notificacion({ id: 9 })]}
        onMarkRead={vi.fn()}
        onDelete={onDelete}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(onDelete).toHaveBeenCalledWith(9)
  })
})
