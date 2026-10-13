import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from '@/pages/auth/Login'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import * as authService from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/auth.service')

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

const MENSAJE_INVALIDO = 'El enlace es inválido o expiró'

function Sonda() {
  const location = useLocation()
  return <p data-testid="ubicacion">{`${location.pathname}${location.search}`}</p>
}

function renderPagina(entrada = '/reset-password?token=tok-reset', { strict = false } = {}) {
  const { Wrapper, client } = createQueryWrapper()
  const arbol = (
    <Wrapper>
      <MemoryRouter initialEntries={[entrada]}>
        <Sonda />
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<div>Pantalla de olvide</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
  render(strict ? <StrictMode>{arbol}</StrictMode> : arbol)
  return { client }
}

async function completar(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirmacion = password
) {
  await user.type(screen.getByLabelText('Contraseña nueva'), password)
  await user.type(screen.getByLabelText('Confirmar contraseña'), confirmacion)
  await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }))
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('saca el token de la URL sin llamar a la API al montar', async () => {
    renderPagina()

    expect(await screen.findByRole('heading', { name: 'Nueva contraseña' })).toBeInTheDocument()
    expect(screen.getByTestId('ubicacion')).toHaveTextContent(/^\/reset-password$/)
    expect(authService.resetPassword).not.toHaveBeenCalled()
  })

  it.each([
    ['Abc123', 'La contraseña necesita mínimo 8 caracteres'],
    ['abcdefg1', 'La contraseña necesita al menos una mayúscula'],
  ])('rechaza "%s" en el cliente sin gastar el token', async (password, mensaje) => {
    const user = userEvent.setup()
    renderPagina()

    await completar(user, password)

    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(authService.resetPassword).not.toHaveBeenCalled()
  })

  it('avisa cuando la confirmacion no coincide', async () => {
    const user = userEvent.setup()
    renderPagina()

    await completar(user, 'Secreta123', 'Secreta456')

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(authService.resetPassword).not.toHaveBeenCalled()
  })

  // El token se leyo de la URL antes de sacarla: el submit lo sigue mandando.
  it('al cambiar la contraseña cierra la sesion, limpia el cache y manda al login con aviso', async () => {
    useAuthStore.getState().setAuth('jwt-viejo', usuario)
    vi.mocked(authService.resetPassword).mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    const { client } = renderPagina()
    const limpiar = vi.spyOn(client, 'clear')

    await completar(user, 'Nueva1234')

    expect(
      await screen.findByText('Tu contraseña se actualizó, iniciá sesión con la nueva')
    ).toBeInTheDocument()
    expect(authService.resetPassword).toHaveBeenCalledWith({
      token: 'tok-reset',
      password: 'Nueva1234',
    })
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(limpiar).toHaveBeenCalled()
  })

  it('con el link vencido muestra el mensaje generico y el link para pedir otro', async () => {
    vi.mocked(authService.resetPassword).mockRejectedValue(
      Object.assign(new Error(MENSAJE_INVALIDO), { status: 400 })
    )
    const user = userEvent.setup()
    renderPagina()

    await completar(user, 'Nueva1234')

    expect(await screen.findByText(MENSAJE_INVALIDO)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute(
      'href',
      '/forgot-password'
    )
  })

  it('muestra los errores por campo del backend sin ofrecer un enlace nuevo', async () => {
    vi.mocked(authService.resetPassword).mockRejectedValue(
      Object.assign(new Error('Datos inválidos'), {
        status: 400,
        details: [{ path: 'password', message: 'La contraseña es demasiado común' }],
      })
    )
    const user = userEvent.setup()
    renderPagina()

    await completar(user, 'Nueva1234')

    expect(await screen.findByText('La contraseña es demasiado común')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Pedir un enlace nuevo' })).toBeNull()
  })

  it('sin token en la URL muestra el mensaje generico y no el formulario', async () => {
    renderPagina('/reset-password')

    expect(await screen.findByText(MENSAJE_INVALIDO)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument()
  })

  it('en StrictMode conserva el token despues de sacarlo de la URL', async () => {
    vi.mocked(authService.resetPassword).mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    renderPagina('/reset-password?token=tok-strict', { strict: true })

    await completar(user, 'Nueva1234')

    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    expect(authService.resetPassword).toHaveBeenCalledWith({
      token: 'tok-strict',
      password: 'Nueva1234',
    })
  })
})
