import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TwoFactorResetConfirmPage from '@/pages/auth/TwoFactorResetConfirmPage'
import * as twoFactorService from '@/services/two-factor.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AuthUser, TwoFactorResetConfirmResponse } from '@/types/auth'

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
const RUTA = '/two-factor/reset/confirm'

const confirmado: TwoFactorResetConfirmResponse = {
  message: 'Reinicio iniciado',
  resetEffectiveAt: '2026-10-20T12:00:00.000Z',
}

function Sonda() {
  const location = useLocation()
  return <p data-testid="ubicacion">{`${location.pathname}${location.search}`}</p>
}

function renderPagina(entrada = `${RUTA}?token=abc123`, { strict = false } = {}) {
  const { Wrapper } = createQueryWrapper()
  const arbol = (
    <Wrapper>
      <MemoryRouter initialEntries={[entrada]}>
        <Sonda />
        <Routes>
          <Route path={RUTA} element={<TwoFactorResetConfirmPage />} />
          <Route path="/login" element={<div>Pantalla de login</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
  return render(strict ? <StrictMode>{arbol}</StrictMode> : arbol)
}

describe('TwoFactorResetConfirmPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAuthStore.getState().logout()
  })

  // Un scanner de mails que ejecuta JS abre el link: si confirmara solo al
  // cargar, cualquiera podria arrancar el reinicio de otra persona.
  it('al cargar no manda nada y saca el token de la URL', async () => {
    renderPagina()

    expect(
      await screen.findByRole('button', { name: 'Confirmar reinicio' })
    ).toBeInTheDocument()
    expect(twoFactorService.confirmTwoFactorReset).not.toHaveBeenCalled()
    expect(screen.getByTestId('ubicacion')).toHaveTextContent(new RegExp(`^${RUTA}$`))
  })

  it('en StrictMode tampoco manda nada al cargar', async () => {
    renderPagina(`${RUTA}?token=abc123`, { strict: true })

    await screen.findByRole('button', { name: 'Confirmar reinicio' })
    expect(twoFactorService.confirmTwoFactorReset).not.toHaveBeenCalled()
  })

  it('al hacer click manda el token del link una sola vez y muestra cuando se completa', async () => {
    vi.mocked(twoFactorService.confirmTwoFactorReset).mockResolvedValue(confirmado)
    const user = userEvent.setup()
    renderPagina()

    await user.click(await screen.findByRole('button', { name: 'Confirmar reinicio' }))

    expect(await screen.findByRole('heading', { name: 'Reinicio en curso' })).toBeInTheDocument()
    expect(screen.getByText(/octubre de 2026/)).toBeInTheDocument()
    expect(twoFactorService.confirmTwoFactorReset).toHaveBeenCalledTimes(1)
    expect(twoFactorService.confirmTwoFactorReset).toHaveBeenCalledWith('abc123')
    expect(screen.queryByRole('button', { name: 'Confirmar reinicio' })).not.toBeInTheDocument()
  })

  it('deshabilita el boton mientras la peticion esta en vuelo: un doble click es un solo POST', async () => {
    vi.mocked(twoFactorService.confirmTwoFactorReset).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderPagina()

    await user.click(await screen.findByRole('button', { name: 'Confirmar reinicio' }))
    const enVuelo = await screen.findByRole('button', { name: 'Confirmando...' })
    await user.click(enVuelo)

    expect(enVuelo).toBeDisabled()
    expect(twoFactorService.confirmTwoFactorReset).toHaveBeenCalledTimes(1)
  })

  it('un link invalido (400) muestra un unico mensaje generico y quita el boton', async () => {
    vi.mocked(twoFactorService.confirmTwoFactorReset).mockRejectedValue(
      Object.assign(new Error(MENSAJE_INVALIDO), { status: 400, code: 'TWO_FACTOR_LINK_INVALID' })
    )
    const user = userEvent.setup()
    renderPagina()

    await user.click(await screen.findByRole('button', { name: 'Confirmar reinicio' }))

    expect(await screen.findByText(MENSAJE_INVALIDO)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar reinicio' })).not.toBeInTheDocument()
  })

  it('un 400 muestra el mensaje generico aunque el backend mande otro texto', async () => {
    vi.mocked(twoFactorService.confirmTwoFactorReset).mockRejectedValue(
      Object.assign(new Error('Otro texto del backend'), { status: 400 })
    )
    const user = userEvent.setup()
    renderPagina()

    await user.click(await screen.findByRole('button', { name: 'Confirmar reinicio' }))

    expect(await screen.findByText(MENSAJE_INVALIDO)).toBeInTheDocument()
    expect(screen.queryByText('Otro texto del backend')).not.toBeInTheDocument()
  })

  it('un error que no es del link (429) muestra su mensaje y deja reintentar', async () => {
    vi.mocked(twoFactorService.confirmTwoFactorReset)
      .mockRejectedValueOnce(Object.assign(new Error('Demasiados pedidos'), { status: 429 }))
      .mockResolvedValueOnce(confirmado)
    const user = userEvent.setup()
    renderPagina()

    await user.click(await screen.findByRole('button', { name: 'Confirmar reinicio' }))
    expect(await screen.findByText('Demasiados pedidos')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar reinicio' }))

    expect(await screen.findByRole('heading', { name: 'Reinicio en curso' })).toBeInTheDocument()
    expect(twoFactorService.confirmTwoFactorReset).toHaveBeenCalledTimes(2)
  })

  it('sin token en la URL muestra el mensaje generico sin boton ni llamada', async () => {
    renderPagina(RUTA)

    expect(await screen.findByText(MENSAJE_INVALIDO)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar reinicio' })).not.toBeInTheDocument()
    expect(twoFactorService.confirmTwoFactorReset).not.toHaveBeenCalled()
  })

  it('no toca la sesion de otra cuenta que este abierta', async () => {
    useAuthStore.getState().setAuth('jwt-de-otra-cuenta', otraCuenta)
    vi.mocked(twoFactorService.confirmTwoFactorReset).mockResolvedValue(confirmado)
    const user = userEvent.setup()
    renderPagina()

    await user.click(await screen.findByRole('button', { name: 'Confirmar reinicio' }))
    await screen.findByRole('heading', { name: 'Reinicio en curso' })

    expect(useAuthStore.getState().token).toBe('jwt-de-otra-cuenta')
    expect(useAuthStore.getState().user).toEqual(otraCuenta)
    expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument()
  })

  it('tampoco crea una sesion cuando no habia ninguna', async () => {
    vi.mocked(twoFactorService.confirmTwoFactorReset).mockResolvedValue(confirmado)
    const user = userEvent.setup()
    renderPagina()

    await user.click(await screen.findByRole('button', { name: 'Confirmar reinicio' }))
    await screen.findByRole('heading', { name: 'Reinicio en curso' })

    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('ofrece ir al login sin sesion y al inicio con sesion', async () => {
    const { unmount } = renderPagina()
    expect(await screen.findByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/login'
    )
    unmount()

    useAuthStore.getState().setAuth('jwt-de-otra-cuenta', otraCuenta)
    renderPagina()
    expect(await screen.findByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  })
})
