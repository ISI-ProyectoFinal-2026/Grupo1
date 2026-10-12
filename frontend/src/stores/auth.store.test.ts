import { afterEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser } from '@/types/auth'

const usuario: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  role: 'usuario_regular',
  emailVerifiedAt: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

describe('auth.store setUser', () => {
  afterEach(() => {
    useAuthStore.getState().logout()
  })

  // Refrescar /me no debe tocar el JWT: solo el usuario cacheado.
  it('reemplaza el usuario y conserva el token', () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', usuario)
    const verificado = { ...usuario, emailVerifiedAt: '2026-09-02T10:00:00.000Z' }

    useAuthStore.getState().setUser(verificado)

    expect(useAuthStore.getState().user).toEqual(verificado)
    expect(useAuthStore.getState().token).toBe('jwt-de-prueba')
  })

  it('persiste el usuario refrescado en patitas-auth', () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', usuario)
    const verificado = { ...usuario, emailVerifiedAt: '2026-09-02T10:00:00.000Z' }

    useAuthStore.getState().setUser(verificado)

    const guardado = JSON.parse(localStorage.getItem('patitas-auth') ?? '{}')
    expect(guardado.state.user.emailVerifiedAt).toBe('2026-09-02T10:00:00.000Z')
  })
})
