import { describe, expect, it } from 'vitest'
import { isEmailUnverified } from '@/utils/email-verification'
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

describe('isEmailUnverified', () => {
  it('es true cuando emailVerifiedAt es null', () => {
    expect(isEmailUnverified(usuario)).toBe(true)
  })

  it('es false cuando el email ya fue verificado', () => {
    expect(isEmailUnverified({ ...usuario, emailVerifiedAt: '2026-09-02T10:00:00.000Z' })).toBe(
      false
    )
  })

  // Una sesion guardada antes de este cambio no trae el campo: es "no se sabe",
  // y mostrar el banner a un usuario ya verificado seria peor que no mostrarlo.
  it('es false cuando el campo no existe (sesion persistida vieja)', () => {
    const vieja = { ...usuario } as Partial<AuthUser>
    delete vieja.emailVerifiedAt
    expect(isEmailUnverified(vieja as AuthUser)).toBe(false)
  })

  it('es false sin usuario', () => {
    expect(isEmailUnverified(null)).toBe(false)
  })
})
