import { render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TwoFactorResetCancelPage from '@/pages/auth/TwoFactorResetCancelPage'
import * as twoFactorService from '@/services/two-factor.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/two-factor.service')

const otraCuenta: AuthUser = {
  id: 9,
  email: 'otra@patitas.test',
  fullName: null,
  phone: null,
  role: 'usuario_regular',
  emailVerifiedAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  twoFactorEnabled: true,
}

const MENSAJE_INVALIDO = 'El enlace es inválido o expiró'
const RUTA = '/two-factor/reset/cancel'

function Sonda() {
  const location = useLocation()
  return <p data-testid="ubicacion">{`${location.pathname}${location.search}`}</p>
}

function renderPagina(entrada = `${RUTA}?token=cancel123`, { strict = false } = {}) {
  const { Wrapper } = createQueryWrapper()
  const arbol = (
    <Wrapper>
      <MemoryRouter initialEntries={[entrada]}>
        <Sonda />
        <Routes>
          <Route path={RUTA} element={<TwoFactorResetCancelPage />} />
          <Route path="/login" element={<div>Pantalla de login</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
  return render(strict ? <StrictMode>{arbol}</StrictMode> : arbol)
}

describe('TwoFactorResetCancelPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('cancela solo al cargar: manda el token una vez y lo saca de la URL', async () => {
    vi.mocked(twoFactorService.cancelTwoFactorReset).mockReturnValue(new Promise(() => {}))

    renderPagina()

    expect(await screen.findByText('Cancelando el reinicio...')).toBeInTheDocument()
    expect(twoFactorService.cancelTwoFactorReset).toHaveBeenCalledTimes(1)
    expect(twoFactorService.cancelTwoFactorReset).toHaveBeenCalledWith('cancel123')
    expect(screen.getByTestId('ubicacion')).toHaveTextContent(new RegExp(`^${RUTA}$`))
  })

  // El token es de un solo uso: un segundo POST (400) taparia el exito del primero.
  it('en StrictMode hace un solo POST', async () => {
    vi.mocked(twoFactorService.cancelTwoFactorReset).mockResolvedValue({ message: 'ok' })

    renderPagina(`${RUTA}?token=cancel123`, { strict: true })

    expect(await screen.findByRole('heading', { name: 'Reinicio cancelado' })).toBeInTheDocument()
    expect(twoFactorService.cancelTwoFactorReset).toHaveBeenCalledTimes(1)
    expect(twoFactorService.cancelTwoFactorReset).toHaveBeenCalledWith('cancel123')
  })

  it('al cancelar avisa que la verificacion en dos pasos sigue activa', async () => {
    vi.mocked(twoFactorService.cancelTwoFactorReset).mockResolvedValue({ message: 'ok' })

    renderPagina()

    expect(await screen.findByRole('heading', { name: 'Reinicio cancelado' })).toBeInTheDocument()
    expect(screen.getByText(/sigue activa/)).toBeInTheDocument()
  })

  it('un link invalido (400) muestra un unico mensaje generico', async () => {
    vi.mocked(twoFactorService.cancelTwoFactorReset).mockRejectedValue(
      Object.assign(new Error('Otro texto del backend'), {
        status: 400,
        code: 'TWO_FACTOR_LINK_INVALID',
      })
    )

    renderPagina()

    expect(await screen.findByText(MENSAJE_INVALIDO)).toBeInTheDocument()
    expect(screen.queryByText('Otro texto del backend')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Reinicio cancelado' })).not.toBeInTheDocument()
  })

  it('un error que no es del link (500) muestra el mensaje del backend', async () => {
    vi.mocked(twoFactorService.cancelTwoFactorReset).mockRejectedValue(
      Object.assign(new Error('Error inesperado, intentá de nuevo'), { status: 500 })
    )

    renderPagina()

    expect(await screen.findByText('Error inesperado, intentá de nuevo')).toBeInTheDocument()
  })

  it('sin token en la URL muestra el mensaje generico sin llamar a la API', async () => {
    renderPagina(RUTA)

    expect(await screen.findByText(MENSAJE_INVALIDO)).toBeInTheDocument()
    expect(twoFactorService.cancelTwoFactorReset).not.toHaveBeenCalled()
  })

  it('no toca la sesion de otra cuenta que este abierta', async () => {
    useAuthStore.getState().setAuth('jwt-de-otra-cuenta', otraCuenta)
    vi.mocked(twoFactorService.cancelTwoFactorReset).mockResolvedValue({ message: 'ok' })

    renderPagina()
    await screen.findByRole('heading', { name: 'Reinicio cancelado' })

    expect(useAuthStore.getState().token).toBe('jwt-de-otra-cuenta')
    expect(useAuthStore.getState().user).toEqual(otraCuenta)
    expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  })

  it('sin sesion ofrece ir al login despues de cancelar', async () => {
    vi.mocked(twoFactorService.cancelTwoFactorReset).mockResolvedValue({ message: 'ok' })

    renderPagina()

    expect(await screen.findByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/login'
    )
    expect(useAuthStore.getState().token).toBeNull()
  })
})
