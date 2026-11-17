import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser } from '@/types/auth'

const usuario: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  role: 'usuario_regular',
  emailVerifiedAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

function SondaLogin() {
  const location = useLocation()
  return <div data-testid='state-login'>{JSON.stringify(location.state)}</div>
}

function renderRutaProtegida(ruta = '/reports/new') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path='/reports/new' element={<div>Crear reporte</div>} />
        </Route>
        <Route
          path='/login'
          element={
            <>
              <div>Iniciar sesión</div>
              <SondaLogin />
            </>
          }
        />
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

  // el login vuelve a la pagina pedida tras iniciar sesion (#187)
  it('pasa al login la ruta pedida con search y hash', () => {
    renderRutaProtegida('/reports/new?tipo=lost#foto')

    expect(JSON.parse(screen.getByTestId('state-login').textContent ?? 'null')).toEqual({
      from: { pathname: '/reports/new', search: '?tipo=lost', hash: '#foto' },
    })
  })
})
