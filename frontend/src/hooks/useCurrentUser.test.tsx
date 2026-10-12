import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_USER_QUERY_KEY, useCurrentUser } from '@/hooks/useCurrentUser'
import * as authService from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/auth.service')

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

describe('useCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('usa la query ["auth","me"]', () => {
    expect(CURRENT_USER_QUERY_KEY).toEqual(['auth', 'me'])
  })

  it('no consulta /me sin sesion', async () => {
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useCurrentUser(), { wrapper: Wrapper })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(authService.getMe).not.toHaveBeenCalled()
  })

  // El caso del usuario que verifico desde otro dispositivo: el store guardado
  // dice "sin verificar" y /me lo corrige al abrir la app.
  it('sincroniza el usuario del store con lo que devuelve /me', async () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', usuario)
    const verificado = { ...usuario, emailVerifiedAt: '2026-09-02T10:00:00.000Z' }
    vi.mocked(authService.getMe).mockResolvedValue(verificado)
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useCurrentUser(), { wrapper: Wrapper })

    await waitFor(() => expect(useAuthStore.getState().user).toEqual(verificado))
    expect(useAuthStore.getState().token).toBe('jwt-de-prueba')
  })

  it('no toca el store si /me falla', async () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', usuario)
    vi.mocked(authService.getMe).mockRejectedValue(new Error('Error inesperado'))
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useCurrentUser(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(useAuthStore.getState().user).toEqual(usuario)
  })
})
