import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser } from '@/types/auth'

const usuario: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

function renderRutaProtegida() {
  return render(
    <MemoryRouter initialEntries={['/reports/new']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path='/reports/new' element={<div>Crear reporte</div>} />
        </Route>
        <Route path='/login' element={<div>Iniciar sesión</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('renderiza la ruta hija cuando hay sesion', () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', usuario)

    renderRutaProtegida()

    expect(screen.getByText('Crear reporte')).toBeInTheDocument()
  })

  it('manda al login cuando no hay token', () => {
    renderRutaProtegida()

    expect(screen.getByText('Iniciar sesión')).toBeInTheDocument()
    expect(screen.queryByText('Crear reporte')).not.toBeInTheDocument()
  })
})
