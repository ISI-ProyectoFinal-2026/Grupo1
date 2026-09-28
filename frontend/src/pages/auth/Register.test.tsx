import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import * as authService from '@/services/auth.service'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/auth.service')

const usuario: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </MemoryRouter>
  )
}

async function completar(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirmacion = password
) {
  await user.type(screen.getByLabelText('Email'), usuario.email)
  await user.type(screen.getByLabelText('Contraseña'), password)
  await user.type(screen.getByLabelText('Confirmar contraseña'), confirmacion)
  await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

describe('Register: validacion de contrasena en el cliente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Las cuatro reglas replican lo que exige el backend. Validarlas antes de
  // llamar a la API evita gastar uno de los 5 intentos por minuto que permite
  // el rate limit de /api/auth en un error que ya sabiamos de antemano.
  it.each([
    ['Abc123', 'La contraseña necesita mínimo 8 caracteres'],
    ['ABCDEFG1', 'La contraseña necesita al menos una minúscula'],
    ['abcdefg1', 'La contraseña necesita al menos una mayúscula'],
    ['Abcdefgh', 'La contraseña necesita al menos un número'],
  ])('rechaza "%s" sin llamar a la API', async (password, mensaje) => {
    const user = userEvent.setup()
    renderRegister()

    await completar(user, password)

    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(authService.register).not.toHaveBeenCalled()
  })

  it('acumula todas las reglas incumplidas a la vez', async () => {
    const user = userEvent.setup()
    renderRegister()

    await completar(user, 'abc')

    expect(await screen.findByText('La contraseña necesita mínimo 8 caracteres')).toBeInTheDocument()
    expect(screen.getByText('La contraseña necesita al menos una mayúscula')).toBeInTheDocument()
    expect(screen.getByText('La contraseña necesita al menos un número')).toBeInTheDocument()
  })

  it('avisa cuando la confirmacion no coincide', async () => {
    const user = userEvent.setup()
    renderRegister()

    await completar(user, 'Secreta123', 'Secreta456')

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(authService.register).not.toHaveBeenCalled()
  })
})

describe('Register: envio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // El registro no devuelve token: por eso termina en el login y no en el feed.
  it('crea la cuenta y manda al login con el aviso de cuenta creada', async () => {
    vi.mocked(authService.register).mockResolvedValue(usuario)
    const user = userEvent.setup()
    renderRegister()

    await completar(user, 'Secreta123')

    await waitFor(() =>
      expect(authService.register).toHaveBeenCalledWith({
        email: usuario.email,
        password: 'Secreta123',
      })
    )
    expect(await screen.findByText('Cuenta creada, iniciá sesión')).toBeInTheDocument()
  })

  it('muestra los errores por campo que devuelve la API', async () => {
    vi.mocked(authService.register).mockRejectedValue(
      Object.assign(new Error('Datos inválidos'), {
        details: [{ path: 'email', message: 'El email ya está registrado' }],
      })
    )
    const user = userEvent.setup()
    renderRegister()

    await completar(user, 'Secreta123')

    expect(await screen.findByText('El email ya está registrado')).toBeInTheDocument()
  })

  it('muestra el mensaje general cuando el error no trae detalles por campo', async () => {
    vi.mocked(authService.register).mockRejectedValue(new Error('Servicio no disponible'))
    const user = userEvent.setup()
    renderRegister()

    await completar(user, 'Secreta123')

    expect(await screen.findByText('Servicio no disponible')).toBeInTheDocument()
  })

  it('cae a un mensaje generico si el rechazo no es un Error', async () => {
    vi.mocked(authService.register).mockRejectedValue('caida de red')
    const user = userEvent.setup()
    renderRegister()

    await completar(user, 'Secreta123')

    expect(await screen.findByText('Error inesperado, intentá de nuevo')).toBeInTheDocument()
  })

  it('deshabilita el boton mientras crea la cuenta', async () => {
    let resolver: (valor: AuthUser) => void = () => {}
    vi.mocked(authService.register).mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve
      })
    )
    const user = userEvent.setup()
    renderRegister()

    await completar(user, 'Secreta123')

    expect(await screen.findByRole('button', { name: 'Creando cuenta...' })).toBeDisabled()

    resolver(usuario)
    await screen.findByText('Cuenta creada, iniciá sesión')
  })
})
