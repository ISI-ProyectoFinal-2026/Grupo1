import { afterEach, describe, expect, it } from 'vitest'
import { isModerator } from '@/hooks/useIsModerator'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser, Role } from '@/types/auth'

function usuario(role: Role): AuthUser {
  return {
    id: 7,
    email: 'franco@patitas.test',
    fullName: null,
    phone: null,
    role,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  }
}

describe('isModerator', () => {
  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('reconoce al moderador', () => {
    expect(isModerator(usuario('moderador'))).toBe(true)
  })

  it('reconoce al admin', () => {
    expect(isModerator(usuario('admin'))).toBe(true)
  })

  it('rechaza al usuario regular', () => {
    expect(isModerator(usuario('usuario_regular'))).toBe(false)
  })

  it('rechaza cuando no hay sesion', () => {
    expect(isModerator(null)).toBe(false)
  })

  // Una sesion guardada antes de que existiera el rol no tiene `role` en
  // localStorage: no debe colarse en el panel por la puerta de atras.
  it('rechaza una sesion persistida sin rol', () => {
    const sinRol = { ...usuario('moderador'), role: undefined } as unknown as AuthUser
    expect(isModerator(sinRol)).toBe(false)
  })
})
