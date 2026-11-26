import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/lib/query-client'
import { handleAuthStorageEvent } from '@/lib/auth-sync'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser } from '@/types/auth'

const KEY = 'patitas-auth'

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

function persisted(token: string | null, user: AuthUser | null) {
  return JSON.stringify({ state: { token, user }, version: 0 })
}

function storageEvent(key: string | null, newValue: string | null) {
  return new StorageEvent('storage', { key, newValue })
}

describe('auth-sync (storage event entre pestanas)', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'viejo', user: usuario })
    queryClient.setQueryData(['notifications'], [1])
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
    queryClient.clear()
    localStorage.clear()
  })

  it('con token null deja la sesion cerrada y vacia el cache', () => {
    localStorage.setItem(KEY, persisted(null, null))

    handleAuthStorageEvent(storageEvent(KEY, persisted(null, null)))

    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('con la clave borrada cierra la sesion', () => {
    localStorage.removeItem(KEY)

    handleAuthStorageEvent(storageEvent(KEY, null))

    expect(useAuthStore.getState().token).toBeNull()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('con otro token rehidrata al nuevo usuario y vacia el cache', () => {
    const otro = { ...usuario, id: 9, email: 'ana@patitas.test' }
    localStorage.setItem(KEY, persisted('nuevo', otro))

    handleAuthStorageEvent(storageEvent(KEY, persisted('nuevo', otro)))

    expect(useAuthStore.getState().token).toBe('nuevo')
    expect(useAuthStore.getState().user).toEqual(otro)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('ignora eventos de otras claves', () => {
    handleAuthStorageEvent(storageEvent('otra-clave', null))

    expect(useAuthStore.getState().token).toBe('viejo')
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
  })

  it('ignora el evento si el token no cambio', () => {
    handleAuthStorageEvent(storageEvent(KEY, persisted('viejo', usuario)))

    expect(useAuthStore.getState().token).toBe('viejo')
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
  })

  it('tolera un valor que no es JSON', () => {
    const clearSpy = vi.spyOn(queryClient, 'clear')

    expect(() => handleAuthStorageEvent(storageEvent(KEY, '{roto'))).not.toThrow()
    expect(useAuthStore.getState().token).toBe('viejo')
    expect(clearSpy).not.toHaveBeenCalled()
  })
})
