import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_USER_QUERY_KEY } from '@/hooks/useCurrentUser'
import { useDisableTwoFactor } from '@/hooks/useDisableTwoFactor'
import { useEnableTwoFactor } from '@/hooks/useEnableTwoFactor'
import { useRegenerateRecoveryCodes } from '@/hooks/useRegenerateRecoveryCodes'
import { useSetupTwoFactor } from '@/hooks/useSetupTwoFactor'
import { TWO_FACTOR_STATUS_QUERY_KEY, useTwoFactorStatus } from '@/hooks/useTwoFactorStatus'
import * as twoFactorService from '@/services/two-factor.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/two-factor.service')

const usuarioActual: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  role: 'usuario_regular',
  emailVerifiedAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  twoFactorEnabled: false,
}

const usuarioNuevo: AuthUser = { ...usuarioActual, twoFactorEnabled: true }

const estado = { enabled: true, recoveryCodesRemaining: 10, resetEffectiveAt: null }

function errorConStatus(message: string, status: number) {
  return Object.assign(new Error(message), { status })
}

describe('hooks de 2FA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth('jwt-viejo', usuarioActual)
    vi.mocked(twoFactorService.getTwoFactorStatus).mockResolvedValue(estado)
  })

  afterEach(() => {
    useAuthStore.getState().logout()
  })

  describe('useTwoFactorStatus', () => {
    it('pide el estado y lo expone', async () => {
      const { Wrapper } = createQueryWrapper()
      const { result } = renderHook(() => useTwoFactorStatus(), { wrapper: Wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(estado)
      expect(twoFactorService.getTwoFactorStatus).toHaveBeenCalledTimes(1)
    })

    it('expone el error de la consulta sin tocar la sesion', async () => {
      vi.mocked(twoFactorService.getTwoFactorStatus).mockRejectedValue(
        errorConStatus('No se pudo cargar', 500)
      )
      const { Wrapper } = createQueryWrapper()
      const { result } = renderHook(() => useTwoFactorStatus(), { wrapper: Wrapper })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error?.message).toBe('No se pudo cargar')
      expect(useAuthStore.getState().token).toBe('jwt-viejo')
    })
  })

  // Enable, disable y regenerate suben tokenVersion: el JWT viejo muere en el
  // servidor, asi que el nuevo tiene que estar en el store antes de cualquier
  // otro pedido (el refetch del estado, el de /me).
  describe.each([
    {
      nombre: 'useEnableTwoFactor',
      servicio: 'enableTwoFactor' as const,
      usar: useEnableTwoFactor,
      entrada: { code: '123456' },
      respuesta: { token: 'jwt-nuevo', user: usuarioNuevo, recoveryCodes: ['AAAAA-BBBBB'] },
    },
    {
      nombre: 'useDisableTwoFactor',
      servicio: 'disableTwoFactor' as const,
      usar: useDisableTwoFactor,
      entrada: { password: 'Secreta123', code: '123456' },
      respuesta: { token: 'jwt-nuevo', user: usuarioNuevo },
    },
    {
      nombre: 'useRegenerateRecoveryCodes',
      servicio: 'regenerateRecoveryCodes' as const,
      usar: useRegenerateRecoveryCodes,
      entrada: { code: '654321' },
      respuesta: { token: 'jwt-nuevo', user: usuarioNuevo, recoveryCodes: ['CCCCC-DDDDD'] },
    },
  ])('$nombre', ({ servicio, usar, entrada, respuesta }) => {
    function renderConEstado() {
      const wrapper = createQueryWrapper()
      const rendered = renderHook(() => ({ estado: useTwoFactorStatus(), mutacion: usar() }), {
        wrapper: wrapper.Wrapper,
      })
      return { ...rendered, client: wrapper.client }
    }

    function mockearServicio(valor: unknown) {
      vi.mocked(
        twoFactorService[servicio] as (input: unknown) => Promise<unknown>
      ).mockResolvedValue(valor)
    }

    it('manda la entrada al servicio y guarda el token y el usuario nuevos', async () => {
      mockearServicio(respuesta)
      const { result } = renderConEstado()
      await waitFor(() => expect(result.current.estado.isSuccess).toBe(true))

      await act(async () => {
        await result.current.mutacion.mutateAsync(entrada as never)
      })

      expect(twoFactorService[servicio]).toHaveBeenCalledWith(entrada)
      expect(useAuthStore.getState().token).toBe('jwt-nuevo')
      expect(useAuthStore.getState().user).toEqual(usuarioNuevo)
    })

    it('guarda el token nuevo ANTES de invalidar y volver a pedir el estado', async () => {
      mockearServicio(respuesta)
      const tokensAlPedir: Array<string | null> = []
      vi.mocked(twoFactorService.getTwoFactorStatus).mockImplementation(async () => {
        tokensAlPedir.push(useAuthStore.getState().token)
        return estado
      })
      const { result } = renderConEstado()
      await waitFor(() => expect(result.current.estado.isSuccess).toBe(true))

      await act(async () => {
        await result.current.mutacion.mutateAsync(entrada as never)
      })

      await waitFor(() => expect(tokensAlPedir).toHaveLength(2))
      expect(tokensAlPedir).toEqual(['jwt-viejo', 'jwt-nuevo'])
    })

    it('invalida el estado de 2FA y el usuario actual despues de guardar el token', async () => {
      mockearServicio(respuesta)
      const { result, client } = renderConEstado()
      await waitFor(() => expect(result.current.estado.isSuccess).toBe(true))
      const tokenAlInvalidar: Array<{ key: readonly unknown[]; token: string | null }> = []
      vi.spyOn(client, 'invalidateQueries').mockImplementation(async (filters) => {
        tokenAlInvalidar.push({
          key: filters?.queryKey ?? [],
          token: useAuthStore.getState().token,
        })
      })

      await act(async () => {
        await result.current.mutacion.mutateAsync(entrada as never)
      })

      expect(tokenAlInvalidar).toEqual([
        { key: TWO_FACTOR_STATUS_QUERY_KEY, token: 'jwt-nuevo' },
        { key: CURRENT_USER_QUERY_KEY, token: 'jwt-nuevo' },
      ])
    })

    it('un codigo o contraseña incorrectos (400/403) no cambian la sesion ni invalidan nada', async () => {
      vi.mocked(twoFactorService[servicio] as (input: unknown) => Promise<unknown>)
        .mockRejectedValueOnce(errorConStatus('El código es inválido o expiró', 400))
        .mockRejectedValueOnce(errorConStatus('La contraseña es incorrecta', 403))
      const { result, client } = renderConEstado()
      await waitFor(() => expect(result.current.estado.isSuccess).toBe(true))
      const invalidar = vi.spyOn(client, 'invalidateQueries')

      await act(async () => {
        await expect(result.current.mutacion.mutateAsync(entrada as never)).rejects.toMatchObject({
          status: 400,
        })
      })
      await act(async () => {
        await expect(result.current.mutacion.mutateAsync(entrada as never)).rejects.toMatchObject({
          status: 403,
        })
      })

      expect(useAuthStore.getState().token).toBe('jwt-viejo')
      expect(useAuthStore.getState().user).toEqual(usuarioActual)
      expect(invalidar).not.toHaveBeenCalled()
    })

    // 409: el estado real es otro (se desactivo en otra pestaña): hay que releerlo.
    it('un 409 vuelve a pedir el estado para que la pantalla se corrija sola', async () => {
      vi.mocked(
        twoFactorService[servicio] as (input: unknown) => Promise<unknown>
      ).mockRejectedValue(errorConStatus('2FA no está activada', 409))
      const { result } = renderConEstado()
      await waitFor(() => expect(result.current.estado.isSuccess).toBe(true))

      await act(async () => {
        await expect(result.current.mutacion.mutateAsync(entrada as never)).rejects.toMatchObject({
          status: 409,
        })
      })

      await waitFor(() => expect(twoFactorService.getTwoFactorStatus).toHaveBeenCalledTimes(2))
      expect(useAuthStore.getState().token).toBe('jwt-viejo')
    })
  })

  // El secreto y los codigos de recuperacion solo viven en el state del
  // componente: la cache de mutaciones no puede retenerlos despues de usarlos.
  describe('datos sensibles', () => {
    it('useSetupTwoFactor devuelve el secreto y la cache no lo retiene tras reiniciar', async () => {
      const setup = { secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/PATITAS:a@b.c' }
      vi.mocked(twoFactorService.setupTwoFactor).mockResolvedValue(setup)
      const { Wrapper, client } = createQueryWrapper()
      const { result } = renderHook(() => useSetupTwoFactor(), { wrapper: Wrapper })

      let devuelto
      await act(async () => {
        devuelto = await result.current.mutateAsync()
      })
      expect(devuelto).toEqual(setup)
      expect(client.getMutationCache().getAll()).toHaveLength(1)

      act(() => result.current.reset())

      await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0))
    })

    it('useEnableTwoFactor no deja los codigos de recuperacion en la cache tras reiniciar', async () => {
      vi.mocked(twoFactorService.enableTwoFactor).mockResolvedValue({
        token: 'jwt-nuevo',
        user: usuarioNuevo,
        recoveryCodes: ['AAAAA-BBBBB'],
      })
      const { Wrapper, client } = createQueryWrapper()
      const { result } = renderHook(() => useEnableTwoFactor(), { wrapper: Wrapper })

      await act(async () => {
        await result.current.mutateAsync({ code: '123456' })
      })
      expect(client.getMutationCache().getAll()).toHaveLength(1)

      act(() => result.current.reset())

      await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0))
    })

    it('useRegenerateRecoveryCodes tampoco los retiene', async () => {
      vi.mocked(twoFactorService.regenerateRecoveryCodes).mockResolvedValue({
        token: 'jwt-nuevo',
        user: usuarioNuevo,
        recoveryCodes: ['CCCCC-DDDDD'],
      })
      const { Wrapper, client } = createQueryWrapper()
      const { result } = renderHook(() => useRegenerateRecoveryCodes(), { wrapper: Wrapper })

      await act(async () => {
        await result.current.mutateAsync({ code: '654321' })
      })
      act(() => result.current.reset())

      await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0))
    })
  })
})
