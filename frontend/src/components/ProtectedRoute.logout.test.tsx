import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/stores/auth.store'

function LoginProbe() {
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from
  return (
    <>
      <p>login</p>
      <output data-testid="from">{from?.pathname ?? 'none'}</output>
    </>
  )
}

function SecurityPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)
  return (
    <button
      type="button"
      onClick={() => {
        navigate('/login', { replace: true })
        setTimeout(logout)
      }}
    >
      Cerrar sesión
    </button>
  )
}

describe('logout desde una ruta protegida', () => {
  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('no deja un destino de retorno apuntando a la ruta protegida', async () => {
    useAuthStore.setState({ token: 'tok', user: null })

    render(
      <MemoryRouter initialEntries={['/account/security']}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/account/security" element={<SecurityPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Cerrar sesión' }).click()
    })

    await waitFor(() => expect(screen.getByText('login')).toBeInTheDocument())
    expect(screen.getByTestId('from')).toHaveTextContent('none')
  })
})
