import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import {
  forgotPassword,
  getMe,
  login,
  register,
  resendVerification,
  resetPassword,
  verifyEmail,
} from '@/services/auth.service'
import type { AuthResponse, AuthUser } from '@/types/auth'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
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
  emailVerifiedAt: null,
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

  // /me devuelve el usuario en la raiz del body, no envuelto en { user }.
  it('lee el usuario actual desde GET /auth/me', async () => {
    const verificado = { ...usuario, emailVerifiedAt: '2026-09-02T10:00:00.000Z' }
    vi.mocked(api.get).mockResolvedValue(respuesta(verificado))

    const resultado = await getMe()

    expect(api.get).toHaveBeenCalledWith('/auth/me')
    expect(resultado).toEqual(verificado)
  })

  it('manda el token del link a POST /auth/verify-email', async () => {
    vi.mocked(api.post).mockResolvedValue(respuesta({ message: 'Tu email quedó verificado' }))

    const resultado = await verifyEmail('token-del-link')

    expect(api.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'token-del-link' })
    expect(resultado).toEqual({ message: 'Tu email quedó verificado' })
  })

  it('pide otro email con POST /auth/verify-email/resend y sin body', async () => {
    vi.mocked(api.post).mockResolvedValue(
      respuesta({ message: 'Te mandamos un nuevo email de verificación' })
    )

    const resultado = await resendVerification()

    expect(api.post).toHaveBeenCalledWith('/auth/verify-email/resend')
    expect(resultado.message).toBe('Te mandamos un nuevo email de verificación')
  })

  it('manda el email a POST /auth/forgot-password', async () => {
    vi.mocked(api.post).mockResolvedValue(respuesta({ message: 'Si el email está registrado' }))

    const resultado = await forgotPassword('franco@patitas.test')

    expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', {
      email: 'franco@patitas.test',
    })
    expect(resultado.message).toBe('Si el email está registrado')
  })

  it('manda token y contraseña nueva a POST /auth/reset-password', async () => {
    vi.mocked(api.post).mockResolvedValue(respuesta({ message: 'Tu contraseña se actualizó' }))

    const resultado = await resetPassword({ token: 'token-reset', password: 'Nueva1234' })

    expect(api.post).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'token-reset',
      password: 'Nueva1234',
    })
    expect(resultado.message).toBe('Tu contraseña se actualizó')
  })

  it('propaga el 400 generico de un link invalido', async () => {
    vi.mocked(api.post).mockRejectedValue(
      Object.assign(new Error('El enlace es inválido o expiró'), { status: 400 })
    )

    await expect(verifyEmail('viejo')).rejects.toThrow('El enlace es inválido o expiró')
  })
})
