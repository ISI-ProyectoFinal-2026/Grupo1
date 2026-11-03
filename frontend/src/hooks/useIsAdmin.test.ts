import { afterEach, describe, expect, it } from 'vitest'
import { isAdmin } from '@/hooks/useIsAdmin'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser, Role } from '@/types/auth'

function usuario(role: Role): AuthUser {
  return {
    id: 7,
    email: 'franco@patitas.test',
    fullName: null,
    phone: null,
    role,
    emailVerifiedAt: '2026-09-01T10:00:00.000Z',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  }
}

describe('isAdmin', () => {
  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('reconoce al admin', () => {
    expect(isAdmin(usuario('admin'))).toBe(true)
  })

  it('rechaza al moderador', () => {
    expect(isAdmin(usuario('moderador'))).toBe(false)
  })

  it('rechaza al usuario regular', () => {
    expect(isAdmin(usuario('usuario_regular'))).toBe(false)
  })

  it('rechaza cuando no hay sesion', () => {
    expect(isAdmin(null)).toBe(false)
  })

  it('rechaza una sesion persistida sin rol', () => {
    const sinRol = { ...usuario('admin'), role: undefined } as unknown as AuthUser
    expect(isAdmin(sinRol)).toBe(false)
  })
})
