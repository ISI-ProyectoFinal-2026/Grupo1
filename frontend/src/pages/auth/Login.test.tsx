import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from '@/pages/auth/Login'
import * as authService from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/auth.service')

const usuario: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: 'Franco Marin',
  phone: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

function renderLogin(state?: { registered?: boolean }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div>Feed de reportes</div>} />
        <Route path="/register" element={<div>Crear cuenta</div>} />
      </Routes>
    </MemoryRouter>
  )
}

async function completarYEnviar(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), usuario.email)
  await user.type(screen.getByLabelText('Contraseña'), 'Secreta123')
  await user.click(screen.getByRole('button', { name: 'Ingresar' }))
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('renderiza los campos y el link a registro', () => {
    renderLogin()

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrate' })).toBeInTheDocument()
  })

  // El aviso viaja en el state de la navegacion que hace Register, no en la
  // URL: si se pierde, el usuario recien registrado no entiende por que
  // aterrizo en el login.
  it('avisa que la cuenta fue creada cuando viene del registro', () => {
    renderLogin({ registered: true })

    expect(screen.getByText('Cuenta creada, iniciá sesión')).toBeInTheDocument()
  })

  it('no muestra el aviso en un ingreso normal', () => {
    renderLogin()

    expect(screen.queryByText('Cuenta creada, iniciá sesión')).not.toBeInTheDocument()
  })

  it('guarda la sesion y redirige al feed cuando el login es correcto', async () => {
    vi.mocked(authService.login).mockResolvedValue({ token: 'jwt-de-prueba', user: usuario })
    const user = userEvent.setup()
    renderLogin()

    await completarYEnviar(user)

    await waitFor(() =>
      expect(authService.login).toHaveBeenCalledWith({
        email: usuario.email,
        password: 'Secreta123',
      })
    )
    expect(await screen.findByText('Feed de reportes')).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBe('jwt-de-prueba')
    expect(useAuthStore.getState().user).toEqual(usuario)
  })

  it('muestra el mensaje del backend y no guarda sesion si falla', async () => {
    vi.mocked(authService.login).mockRejectedValue(new Error('Credenciales inválidas'))
    const user = userEvent.setup()
    renderLogin()

    await completarYEnviar(user)

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBeNull()
    expect(screen.queryByText('Feed de reportes')).not.toBeInTheDocument()
  })

  it('cae a un mensaje generico si el rechazo no es un Error', async () => {
    vi.mocked(authService.login).mockRejectedValue('caida de red')
    const user = userEvent.setup()
    renderLogin()

    await completarYEnviar(user)

    expect(await screen.findByText('Error inesperado, intentá de nuevo')).toBeInTheDocument()
  })

  // Sin el disabled, un doble click manda dos veces el login y el rate limit
  // del backend (5 por minuto en /api/auth) empieza a devolver 429.
  it('deshabilita el boton mientras la peticion esta en vuelo', async () => {
    let resolver: (valor: { token: string; user: AuthUser }) => void = () => {}
    vi.mocked(authService.login).mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve
      })
    )
    const user = userEvent.setup()
    renderLogin()

    await completarYEnviar(user)

    expect(await screen.findByRole('button', { name: 'Ingresando...' })).toBeDisabled()

    resolver({ token: 'jwt-de-prueba', user: usuario })
    await screen.findByText('Feed de reportes')
  })
})
