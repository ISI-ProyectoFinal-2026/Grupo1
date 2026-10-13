import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import {
  cancelTwoFactorReset,
  confirmTwoFactorReset,
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  loginWithTwoFactor,
  regenerateRecoveryCodes,
  requestTwoFactorReset,
  setupTwoFactor,
} from '@/services/two-factor.service'
import type { AuthUser } from '@/types/auth'

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
  emailVerifiedAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  twoFactorEnabled: true,
}

describe('two-factor.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loginWithTwoFactor', () => {
    it('manda el desafio y el codigo a POST /auth/2fa/login y devuelve la sesion', async () => {
      vi.mocked(api.post).mockResolvedValue(respuesta({ token: 'jwt-nuevo', user: usuario }))

      const resultado = await loginWithTwoFactor({ twoFactorToken: 'desafio', code: '123456' })

      expect(api.post).toHaveBeenCalledWith('/auth/2fa/login', {
        twoFactorToken: 'desafio',
        code: '123456',
      })
      expect(resultado).toEqual({ token: 'jwt-nuevo', user: usuario })
    })

    it('manda un codigo de recuperacion tal cual, en el mismo campo', async () => {
      vi.mocked(api.post).mockResolvedValue(respuesta({ token: 'jwt-nuevo', user: usuario }))

      await loginWithTwoFactor({ twoFactorToken: 'desafio', code: 'ABCDE-FGHIJ' })

      expect(api.post).toHaveBeenCalledWith('/auth/2fa/login', {
        twoFactorToken: 'desafio',
        code: 'ABCDE-FGHIJ',
      })
    })

    it('propaga el error del interceptor con su code y status', async () => {
      vi.mocked(api.post).mockRejectedValue(
        Object.assign(new Error('El código es inválido o expiró'), {
          status: 400,
          code: 'INVALID_TWO_FACTOR_CODE',
        })
      )

      await expect(
        loginWithTwoFactor({ twoFactorToken: 'desafio', code: '000000' })
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_TWO_FACTOR_CODE' })
    })
  })

  describe('requestTwoFactorReset', () => {
    it('manda desafio y contraseña a POST /auth/2fa/reset/request', async () => {
      vi.mocked(api.post).mockResolvedValue(respuesta({ message: 'Te mandamos un email' }))

      const resultado = await requestTwoFactorReset({
        twoFactorToken: 'desafio',
        password: 'Secreta123',
      })

      expect(api.post).toHaveBeenCalledWith('/auth/2fa/reset/request', {
        twoFactorToken: 'desafio',
        password: 'Secreta123',
      })
      expect(resultado).toEqual({ message: 'Te mandamos un email' })
    })

    it('propaga el 403 de contraseña incorrecta', async () => {
      vi.mocked(api.post).mockRejectedValue(
        Object.assign(new Error('Contraseña incorrecta'), { status: 403 })
      )

      await expect(
        requestTwoFactorReset({ twoFactorToken: 'desafio', password: 'mala' })
      ).rejects.toMatchObject({ status: 403 })
    })
  })

  describe('confirmTwoFactorReset', () => {
    it('manda el token del link a POST /auth/2fa/reset/confirm y devuelve la fecha', async () => {
      vi.mocked(api.post).mockResolvedValue(
        respuesta({ message: 'Reinicio iniciado', resetEffectiveAt: '2026-10-20T12:00:00.000Z' })
      )

      const resultado = await confirmTwoFactorReset('token-del-link')

      expect(api.post).toHaveBeenCalledWith('/auth/2fa/reset/confirm', {
        token: 'token-del-link',
      })
      expect(resultado.resetEffectiveAt).toBe('2026-10-20T12:00:00.000Z')
    })

    it('propaga el 400 generico de un link invalido', async () => {
      vi.mocked(api.post).mockRejectedValue(
        Object.assign(new Error('El enlace es inválido o expiró'), { status: 400 })
      )

      await expect(confirmTwoFactorReset('viejo')).rejects.toThrow('El enlace es inválido o expiró')
    })
  })

  describe('cancelTwoFactorReset', () => {
    it('manda el token del link a POST /auth/2fa/reset/cancel', async () => {
      vi.mocked(api.post).mockResolvedValue(respuesta({ message: 'Reinicio cancelado' }))

      const resultado = await cancelTwoFactorReset('token-de-cancelacion')

      expect(api.post).toHaveBeenCalledWith('/auth/2fa/reset/cancel', {
        token: 'token-de-cancelacion',
      })
      expect(resultado).toEqual({ message: 'Reinicio cancelado' })
    })
  })

  describe('getTwoFactorStatus', () => {
    it('pide GET /auth/2fa/status y devuelve el estado', async () => {
      vi.mocked(api.get).mockResolvedValue(
        respuesta({ enabled: true, recoveryCodesRemaining: 8, resetEffectiveAt: null })
      )

      const resultado = await getTwoFactorStatus()

      expect(api.get).toHaveBeenCalledWith('/auth/2fa/status')
      expect(resultado).toEqual({ enabled: true, recoveryCodesRemaining: 8, resetEffectiveAt: null })
    })

    it('conserva la fecha de un reinicio pendiente', async () => {
      vi.mocked(api.get).mockResolvedValue(
        respuesta({
          enabled: true,
          recoveryCodesRemaining: 2,
          resetEffectiveAt: '2026-10-20T12:00:00.000Z',
        })
      )

      const resultado = await getTwoFactorStatus()

      expect(resultado.resetEffectiveAt).toBe('2026-10-20T12:00:00.000Z')
    })
  })

  describe('setupTwoFactor', () => {
    it('hace POST /auth/2fa/setup sin cuerpo y devuelve secreto y URI', async () => {
      vi.mocked(api.post).mockResolvedValue(
        respuesta({ secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/PATITAS:a@b.c?x=1' })
      )

      const resultado = await setupTwoFactor()

      expect(api.post).toHaveBeenCalledWith('/auth/2fa/setup')
      expect(resultado).toEqual({
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUri: 'otpauth://totp/PATITAS:a@b.c?x=1',
      })
    })

    it('propaga el 403 de email sin verificar con su code', async () => {
      vi.mocked(api.post).mockRejectedValue(
        Object.assign(new Error('Verificá tu email'), { status: 403, code: 'EMAIL_NOT_VERIFIED' })
      )

      await expect(setupTwoFactor()).rejects.toMatchObject({
        status: 403,
        code: 'EMAIL_NOT_VERIFIED',
      })
    })
  })

  describe('enableTwoFactor', () => {
    it('manda el codigo a POST /auth/2fa/enable y devuelve sesion nueva y codigos', async () => {
      const codigos = ['AAAAA-BBBBB', 'CCCCC-DDDDD']
      vi.mocked(api.post).mockResolvedValue(
        respuesta({ token: 'jwt-nuevo', user: usuario, recoveryCodes: codigos })
      )

      const resultado = await enableTwoFactor({ code: '123456' })

      expect(api.post).toHaveBeenCalledWith('/auth/2fa/enable', { code: '123456' })
      expect(resultado).toEqual({ token: 'jwt-nuevo', user: usuario, recoveryCodes: codigos })
    })

    it('propaga el 400 de codigo invalido', async () => {
      vi.mocked(api.post).mockRejectedValue(
        Object.assign(new Error('El código es inválido o expiró'), { status: 400 })
      )

      await expect(enableTwoFactor({ code: '000000' })).rejects.toMatchObject({ status: 400 })
    })
  })

  describe('disableTwoFactor', () => {
    it('manda contraseña y codigo a POST /auth/2fa/disable y devuelve la sesion', async () => {
      vi.mocked(api.post).mockResolvedValue(respuesta({ token: 'jwt-nuevo', user: usuario }))

      const resultado = await disableTwoFactor({ password: 'Secreta123', code: '123456' })

      expect(api.post).toHaveBeenCalledWith('/auth/2fa/disable', {
        password: 'Secreta123',
        code: '123456',
      })
      expect(resultado).toEqual({ token: 'jwt-nuevo', user: usuario })
    })

    it('manda un codigo de recuperacion en el mismo campo', async () => {
      vi.mocked(api.post).mockResolvedValue(respuesta({ token: 'jwt-nuevo', user: usuario }))

      await disableTwoFactor({ password: 'Secreta123', code: 'ABCDE-FGHIJ' })

      expect(api.post).toHaveBeenCalledWith('/auth/2fa/disable', {
        password: 'Secreta123',
        code: 'ABCDE-FGHIJ',
      })
    })
  })

  describe('regenerateRecoveryCodes', () => {
    it('manda el TOTP a POST /auth/2fa/recovery-codes y devuelve sesion nueva y codigos', async () => {
      vi.mocked(api.post).mockResolvedValue(
        respuesta({ token: 'jwt-nuevo', user: usuario, recoveryCodes: ['EEEEE-FFFFF'] })
      )

      const resultado = await regenerateRecoveryCodes({ code: '654321' })

      expect(api.post).toHaveBeenCalledWith('/auth/2fa/recovery-codes', { code: '654321' })
      expect(resultado.recoveryCodes).toEqual(['EEEEE-FFFFF'])
      expect(resultado.token).toBe('jwt-nuevo')
    })
  })
})
