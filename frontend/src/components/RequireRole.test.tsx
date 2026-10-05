import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import RequireRole from '@/components/RequireRole'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser, Role } from '@/types/auth'

function usuario(role: Role): AuthUser {
  return {
    id: 7,
    email: 'franco@patitas.test',
    fullName: null,
    phone: null,
    role,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  }
}

function renderRutaPorRol() {
  return render(
    <MemoryRouter initialEntries={['/moderation']}>
      <Routes>
        <Route element={<RequireRole roles={['moderador', 'admin']} />}>
          <Route path='/moderation' element={<div>Panel de moderación</div>} />
        </Route>
        <Route path='/' element={<div>Inicio</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RequireRole', () => {
  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('renderiza la ruta hija cuando el rol alcanza', () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', usuario('moderador'))

    renderRutaPorRol()

    expect(screen.getByText('Panel de moderación')).toBeInTheDocument()
  })

  it('manda al inicio cuando el rol no alcanza', () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', usuario('usuario_regular'))

    renderRutaPorRol()

    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.queryByText('Panel de moderación')).not.toBeInTheDocument()
  })

  it('manda al inicio cuando no hay usuario en el store', () => {
    renderRutaPorRol()

    expect(screen.getByText('Inicio')).toBeInTheDocument()
  })
})
