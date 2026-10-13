import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from '@/pages/auth/Login'
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage'
import * as authService from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/auth.service')

const sinVerificar: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  role: 'usuario_regular',
  emailVerifiedAt: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}
const verificado: AuthUser = { ...sinVerificar, emailVerifiedAt: '2026-09-02T10:00:00.000Z' }

const MENSAJE_INVALIDO = 'El enlace es inválido o expiró'

function Sonda() {
  const location = useLocation()
  return <p data-testid="ubicacion">{`${location.pathname}${location.search}`}</p>
}

function renderPagina(entrada = '/verify-email?token=abc123', { strict = false } = {}) {
  const { Wrapper } = createQueryWrapper()
  const arbol = (
    <Wrapper>
      <MemoryRouter initialEntries={[entrada]}>
        <Sonda />
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Inicio de la app</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
  return render(strict ? <StrictMode>{arbol}</StrictMode> : arbol)
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('manda el token del link una sola vez y lo saca de la URL', async () => {
    vi.mocked(authService.verifyEmail).mockReturnValue(new Promise(() => {}))

    renderPagina()

    expect(await screen.findByText('Verificando tu email...')).toBeInTheDocument()
    expect(authService.verifyEmail).toHaveBeenCalledWith('abc123')
    expect(screen.getByTestId('ubicacion')).toHaveTextContent(/^\/verify-email$/)
  })

  // StrictMode monta, desmonta y vuelve a montar: sin el guard el token se
  // consumiria dos veces y el segundo intento (400) pisaria el exito.
  it('en StrictMode hace un solo POST', async () => {
    vi.mocked(authService.verifyEmail).mockReturnValue(new Promise(() => {}))

    renderPagina('/verify-email?token=abc123', { strict: true })

    await screen.findByText('Verificando tu email...')
    expect(authService.verifyEmail).toHaveBeenCalledTimes(1)
    expect(authService.verifyEmail).toHaveBeenCalledWith('abc123')
  })

  it('sin sesion manda al login con el aviso de email verificado', async () => {
    vi.mocked(authService.verifyEmail).mockResolvedValue({ message: 'ok' })

    renderPagina()

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByText('Tu email quedó verificado, iniciá sesión')).toBeInTheDocument()
    expect(authService.getMe).not.toHaveBeenCalled()
  })

  it('con la misma cuenta sin verificar refresca /me, actualiza el store y va al inicio', async () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', sinVerificar)
    vi.mocked(authService.verifyEmail).mockResolvedValue({ message: 'ok' })
    vi.mocked(authService.getMe).mockResolvedValue(verificado)

    renderPagina()

    expect(await screen.findByText('Inicio de la app')).toBeInTheDocument()
    expect(useAuthStore.getState().user).toEqual(verificado)
    expect(useAuthStore.getState().token).toBe('jwt-de-prueba')
  })

  // El link es de otra cuenta (B) y acá hay una sesión (A) sin verificar: /me
  // sigue diciendo que A no está verificada, así que no se toca la sesión.
  it('con el link de otra cuenta muestra el exito y deja la sesion intacta', async () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', sinVerificar)
    vi.mocked(authService.verifyEmail).mockResolvedValue({ message: 'ok' })
    vi.mocked(authService.getMe).mockResolvedValue(sinVerificar)

    renderPagina()

    expect(await screen.findByRole('heading', { name: 'Email verificado' })).toBeInTheDocument()
    expect(useAuthStore.getState().user).toEqual(sinVerificar)
    expect(useAuthStore.getState().token).toBe('jwt-de-prueba')
    expect(screen.queryByText('Inicio de la app')).not.toBeInTheDocument()
  })

  it('con una sesion ya verificada muestra el exito sin consultar /me', async () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', verificado)
    vi.mocked(authService.verifyEmail).mockResolvedValue({ message: 'ok' })

    renderPagina()

    expect(await screen.findByRole('heading', { name: 'Email verificado' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
    expect(authService.getMe).not.toHaveBeenCalled()
  })

  // Sin sesión no se ofrece reenviar: no hay a quién (el endpoint exige JWT).
  it('link usado sin sesion: mensaje generico y link al login, sin reenviar', async () => {
    vi.mocked(authService.verifyEmail).mockRejectedValue(
      Object.assign(new Error(MENSAJE_INVALIDO), { status: 400 })
    )

    renderPagina()

    expect(await screen.findByText(MENSAJE_INVALIDO)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Iniciá sesión' })).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('button', { name: 'Reenviar email de verificación' })).toBeNull()
    expect(authService.resendVerification).not.toHaveBeenCalled()
  })

  it('link usado con sesion sin verificar: ofrece reenviar el email', async () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', sinVerificar)
    vi.mocked(authService.verifyEmail).mockRejectedValue(
      Object.assign(new Error(MENSAJE_INVALIDO), { status: 400 })
    )
    vi.mocked(authService.resendVerification).mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()

    renderPagina()

    expect(await screen.findByText(MENSAJE_INVALIDO)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reenviar email de verificación' }))
    await waitFor(() => expect(authService.resendVerification).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Te mandamos un nuevo email')).toBeInTheDocument()
  })

  it('link usado con sesion ya verificada: mensaje generico y link al inicio', async () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', verificado)
    vi.mocked(authService.verifyEmail).mockRejectedValue(
      Object.assign(new Error(MENSAJE_INVALIDO), { status: 400 })
    )

    renderPagina()

    expect(await screen.findByText(MENSAJE_INVALIDO)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button', { name: 'Reenviar email de verificación' })).toBeNull()
  })

  it('sin token en la URL muestra el mensaje generico sin llamar a la API', async () => {
    renderPagina('/verify-email')

    expect(await screen.findByText(MENSAJE_INVALIDO)).toBeInTheDocument()
    expect(authService.verifyEmail).not.toHaveBeenCalled()
  })
})
