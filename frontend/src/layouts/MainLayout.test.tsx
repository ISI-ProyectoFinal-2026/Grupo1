import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MainLayout from '@/layouts/MainLayout'
import { createQueryWrapper } from '@/test/query-wrapper'
import { useAuthStore } from '@/stores/auth.store'
import * as notificationsService from '@/services/notifications.service'

vi.mock('@/services/notifications.service')

const usuario = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: 'Franco',
  phone: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function renderLayout() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter>
        <MainLayout />
      </MemoryRouter>
    </Wrapper>
  )
}

describe('MainLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(notificationsService.listNotifications).mockResolvedValue([])
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('muestra el bell de notificaciones con sesion iniciada', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })

    renderLayout()

    expect(await screen.findByRole('button', { name: 'Notificaciones' })).toBeInTheDocument()
  })

  it('no muestra el bell sin sesion', async () => {
    useAuthStore.setState({ token: null, user: null })

    renderLayout()

    await waitFor(() => expect(screen.getByText('PATITAS')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Notificaciones' })).not.toBeInTheDocument()
    expect(notificationsService.listNotifications).not.toHaveBeenCalled()
  })
})
