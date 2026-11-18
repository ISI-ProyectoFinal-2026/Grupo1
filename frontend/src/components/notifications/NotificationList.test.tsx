import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import NotificationList from '@/components/notifications/NotificationList'
import type { NotificationDTO } from '@/types/notification.types'

function DetalleFalso() {
  const { id } = useParams()
  return <p>Detalle del reporte {id}</p>
}

function ChatFalso() {
  const { id } = useParams()
  return <p>Chat {id}</p>
}

function renderConRouter(ui: ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path='/' element={ui} />
        <Route path='/reports/:id' element={<DetalleFalso />} />
        <Route path='/chats/:id' element={<ChatFalso />} />
      </Routes>
    </MemoryRouter>
  )
}

function coincidencia(overrides: Partial<NotificationDTO> = {}): NotificationDTO {
  return notificacion({
    id: 21,
    type: 'match_suggested',
    title: '¡Posible coincidencia encontrada!',
    message: 'Encontramos una publicación que podría coincidir.',
    reportId: 15,
    ...overrides,
  })
}

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

  it('muestra la notificacion de cambio de rol con su titulo y mensaje', () => {
    render(
      <NotificationList
        notifications={[
          notificacion({
            type: 'role_change',
            title: 'Tu rol cambió',
            message: 'Un administrador cambió tu rol a Moderador.',
          }),
        ]}
        onMarkRead={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('Tu rol cambió')).toBeInTheDocument()
    expect(screen.getByText('Un administrador cambió tu rol a Moderador.')).toBeInTheDocument()
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

  it('ofrece las acciones en un aviso de inactividad con reporte', () => {
    const { Wrapper } = createQueryWrapper()
    renderConRouter(
      <Wrapper>
        <NotificationList
          notifications={[notificacion({ type: 'inactivity_warning', reportId: 5 })]}
          onMarkRead={vi.fn()}
          onDelete={vi.fn()}
        />
      </Wrapper>
    )

    expect(screen.getByRole('button', { name: 'Caso resuelto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seguir mostrando' })).toBeInTheDocument()
  })

  it('no ofrece las acciones en un aviso de inactividad ya leido', () => {
    const { Wrapper } = createQueryWrapper()
    renderConRouter(
      <Wrapper>
        <NotificationList
          notifications={[notificacion({ type: 'inactivity_warning', reportId: 5, isRead: true })]}
          onMarkRead={vi.fn()}
          onDelete={vi.fn()}
        />
      </Wrapper>
    )

    expect(screen.queryByRole('button', { name: 'Seguir mostrando' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Caso resuelto' })).not.toBeInTheDocument()
  })

  it('no ofrece las acciones en un aviso de inactividad sin reporte', () => {
    render(
      <NotificationList
        notifications={[notificacion({ type: 'inactivity_warning', reportId: null })]}
        onMarkRead={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.queryByRole('button', { name: 'Seguir mostrando' })).not.toBeInTheDocument()
  })

  it('el cierre por inactividad se muestra como una notificacion comun', () => {
    renderConRouter(
      <NotificationList
        notifications={[
          notificacion({ type: 'inactivity_closed', title: 'Cerramos tu reporte', reportId: 5 }),
        ]}
        onMarkRead={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('Cerramos tu reporte')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Seguir mostrando' })).not.toBeInTheDocument()
  })

  describe('enlace al reporte mencionado (#222)', () => {
    it('una notificacion con reporte enlaza a su detalle', () => {
      renderConRouter(
        <NotificationList notifications={[coincidencia()]} onMarkRead={vi.fn()} onDelete={vi.fn()} />
      )

      expect(
        screen.getByRole('link', { name: /Posible coincidencia encontrada/ })
      ).toHaveAttribute('href', '/reports/15')
    })

    it('una notificacion sin reporte no es un enlace', () => {
      render(
        <NotificationList notifications={[notificacion()]} onMarkRead={vi.fn()} onDelete={vi.fn()} />
      )

      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(screen.getByText('Nuevo mensaje')).toBeInTheDocument()
    })

    it('al abrirla navega al reporte, la marca como leida y avisa la navegacion', async () => {
      const user = userEvent.setup()
      const onMarkRead = vi.fn()
      const onNavigate = vi.fn()
      renderConRouter(
        <NotificationList
          notifications={[coincidencia()]}
          onMarkRead={onMarkRead}
          onDelete={vi.fn()}
          onNavigate={onNavigate}
        />
      )

      await user.click(screen.getByRole('link', { name: /Posible coincidencia encontrada/ }))

      expect(screen.getByText('Detalle del reporte 15')).toBeInTheDocument()
      expect(onMarkRead).toHaveBeenCalledWith(21)
      expect(onNavigate).toHaveBeenCalledTimes(1)
    })

    it('no vuelve a marcar como leida una ya leida', async () => {
      const user = userEvent.setup()
      const onMarkRead = vi.fn()
      renderConRouter(
        <NotificationList
          notifications={[coincidencia({ isRead: true })]}
          onMarkRead={onMarkRead}
          onDelete={vi.fn()}
        />
      )

      await user.click(screen.getByRole('link', { name: /Posible coincidencia encontrada/ }))

      expect(screen.getByText('Detalle del reporte 15')).toBeInTheDocument()
      expect(onMarkRead).not.toHaveBeenCalled()
    })

    it('se abre con el teclado', async () => {
      const user = userEvent.setup()
      renderConRouter(
        <NotificationList notifications={[coincidencia()]} onMarkRead={vi.fn()} onDelete={vi.fn()} />
      )

      await user.tab()
      expect(screen.getByRole('link', { name: /Posible coincidencia encontrada/ })).toHaveFocus()
      await user.keyboard('{Enter}')

      expect(screen.getByText('Detalle del reporte 15')).toBeInTheDocument()
    })

    it('un mensaje con chat enlaza al chat antes que al reporte', () => {
      renderConRouter(
        <NotificationList
          notifications={[notificacion({ id: 33, reportId: 15, chatId: 8 })]}
          onMarkRead={vi.fn()}
          onDelete={vi.fn()}
        />
      )

      expect(screen.getByRole('link', { name: /Nuevo mensaje/ })).toHaveAttribute('href', '/chats/8')
    })

    it('al abrir un mensaje navega al chat, lo marca como leido y avisa la navegacion', async () => {
      const user = userEvent.setup()
      const onMarkRead = vi.fn()
      const onNavigate = vi.fn()
      renderConRouter(
        <NotificationList
          notifications={[notificacion({ id: 33, reportId: 15, chatId: 8 })]}
          onMarkRead={onMarkRead}
          onDelete={vi.fn()}
          onNavigate={onNavigate}
        />
      )

      await user.click(screen.getByRole('link', { name: /Nuevo mensaje/ }))

      expect(screen.getByText('Chat 8')).toBeInTheDocument()
      expect(onMarkRead).toHaveBeenCalledWith(33)
      expect(onNavigate).toHaveBeenCalledTimes(1)
    })

    it('un mensaje anterior sin chat sigue enlazando al reporte', () => {
      renderConRouter(
        <NotificationList
          notifications={[notificacion({ reportId: 15, chatId: null })]}
          onMarkRead={vi.fn()}
          onDelete={vi.fn()}
        />
      )

      expect(screen.getByRole('link', { name: /Nuevo mensaje/ })).toHaveAttribute('href', '/reports/15')
    })

    it('marcar como leida y eliminar no navegan', async () => {
      const user = userEvent.setup()
      const onMarkRead = vi.fn()
      const onDelete = vi.fn()
      renderConRouter(
        <NotificationList notifications={[coincidencia()]} onMarkRead={onMarkRead} onDelete={onDelete} />
      )

      await user.click(screen.getByRole('button', { name: 'Marcar como leída' }))
      await user.click(screen.getByRole('button', { name: 'Eliminar' }))

      expect(onMarkRead).toHaveBeenCalledWith(21)
      expect(onDelete).toHaveBeenCalledWith(21)
      expect(screen.queryByText(/Detalle del reporte/)).not.toBeInTheDocument()
    })
  })
})
