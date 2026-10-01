import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import { login, register } from '@/services/auth.service'
import type { AuthResponse, AuthUser } from '@/types/auth'

vi.mock('@/services/api', () => ({
  api: { post: vi.fn() },
}))

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

const usuario: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: 'Franco Marin',
  phone: null,
  role: 'usuario_regular',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve token y usuario desde POST /auth/login', async () => {
    const sesion: AuthResponse = { token: 'jwt-de-prueba', user: usuario }
    vi.mocked(api.post).mockResolvedValue(respuesta(sesion))

    const resultado = await login({ email: usuario.email, password: 'secreta123' })

    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: usuario.email,
      password: 'secreta123',
    })
    expect(resultado).toEqual(sesion)
  })

  // El registro no autentica: devuelve el usuario creado, sin token. Si algun
  // dia empieza a devolver sesion, este test se rompe y hay que revisar el
  // flujo de Register.tsx, que hoy redirige al login.
  it('devuelve solo el usuario creado desde POST /auth/register', async () => {
    vi.mocked(api.post).mockResolvedValue(respuesta(usuario))

    const resultado = await register({ email: usuario.email, password: 'secreta123' })

    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      email: usuario.email,
      password: 'secreta123',
    })
    expect(resultado).toEqual(usuario)
    expect(resultado).not.toHaveProperty('token')
  })

  it('propaga el error del interceptor cuando las credenciales fallan', async () => {
    vi.mocked(api.post).mockRejectedValue(
      Object.assign(new Error('Credenciales invalidas'), { status: 401 })
    )

    await expect(login({ email: usuario.email, password: 'mala' })).rejects.toThrow(
      'Credenciales invalidas'
    )
  })
})
