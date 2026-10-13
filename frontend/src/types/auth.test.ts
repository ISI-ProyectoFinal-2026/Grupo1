import { describe, expect, it } from 'vitest'
import { isTwoFactorChallenge } from '@/types/auth'
import type { AuthUser, LoginResponse } from '@/types/auth'

// Los fixtures viejos no traen `twoFactorEnabled`: si el campo dejara de ser
// opcional, este archivo (y unos 20 más) dejaría de compilar.
const usuarioSinCampo: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  role: 'usuario_regular',
  emailVerifiedAt: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

describe('isTwoFactorChallenge', () => {
  it('reconoce el desafio de segundo factor', () => {
    const respuesta: LoginResponse = { twoFactorRequired: true, twoFactorToken: 'opaco' }

    expect(isTwoFactorChallenge(respuesta)).toBe(true)
  })

  it('reconoce el desafio con la fecha de un reinicio pendiente', () => {
    const respuesta: LoginResponse = {
      twoFactorRequired: true,
      twoFactorToken: 'opaco',
      resetEffectiveAt: '2026-10-20T12:00:00.000Z',
    }

    expect(isTwoFactorChallenge(respuesta)).toBe(true)
  })

  it('una sesion normal no es un desafio', () => {
    const respuesta: LoginResponse = { token: 'jwt', user: usuarioSinCampo }

    expect(isTwoFactorChallenge(respuesta)).toBe(false)
  })

  it('una sesion de un reinicio madurado (2FA ya apagado) no es un desafio', () => {
    const respuesta: LoginResponse = {
      token: 'jwt',
      user: { ...usuarioSinCampo, twoFactorEnabled: false },
    }

    expect(isTwoFactorChallenge(respuesta)).toBe(false)
  })
})
