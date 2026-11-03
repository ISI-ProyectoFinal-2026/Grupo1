import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_USER_QUERY_KEY } from '@/hooks/useCurrentUser'
import { useAdminUsers, useChangeUserRole, useRoleAudit } from '@/hooks/useAdminUsers'
import * as adminService from '@/services/admin.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AdminUser } from '@/types/admin.types'

vi.mock('@/services/admin.service')

const usuario: AdminUser = {
  id: 4,
  email: 'ana@example.com',
  fullName: 'Ana',
  role: 'moderador',
  createdAt: '2026-09-01T10:00:00.000Z',
}

function errorConStatus(message: string, status: number) {
  return Object.assign(new Error(message), { status })
}

describe('useAdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consulta la lista con los filtros recibidos', async () => {
    const pagina = { items: [usuario], total: 1, page: 1, pageSize: 20 }
    vi.mocked(adminService.listAdminUsers).mockResolvedValue(pagina)
    const { Wrapper } = createQueryWrapper()
    const params = { q: 'ana', role: '' as const, page: 1, pageSize: 20 }

    const { result } = renderHook(() => useAdminUsers(params), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data).toEqual(pagina))
    expect(adminService.listAdminUsers).toHaveBeenCalledWith(params)
  })
})

describe('useRoleAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consulta el registro con la paginación recibida', async () => {
    const pagina = { items: [], total: 0, page: 2, pageSize: 10 }
    vi.mocked(adminService.listRoleAudit).mockResolvedValue(pagina)
    const { Wrapper } = createQueryWrapper()
    const params = { page: 2, pageSize: 10 }

    const { result } = renderHook(() => useRoleAudit(params), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data).toEqual(pagina))
    expect(adminService.listRoleAudit).toHaveBeenCalledWith(params)
  })
})

describe('useChangeUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('al cambiar el rol invalida la lista y el registro de cambios', async () => {
    vi.mocked(adminService.changeUserRole).mockResolvedValue(usuario)
    const { Wrapper, client } = createQueryWrapper()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useChangeUserRole(), { wrapper: Wrapper })

    act(() => result.current.mutate({ id: 4, role: 'moderador' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(adminService.changeUserRole).toHaveBeenCalledWith(4, 'moderador')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'users'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'role-audit'] })
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: CURRENT_USER_QUERY_KEY })
  })

  it('ante un 403 invalida el usuario actual para que se refresque su rol', async () => {
    vi.mocked(adminService.changeUserRole).mockRejectedValue(errorConStatus('Prohibido', 403))
    const { Wrapper, client } = createQueryWrapper()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useChangeUserRole(), { wrapper: Wrapper })

    act(() => result.current.mutate({ id: 4, role: 'admin' }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: CURRENT_USER_QUERY_KEY })
  })

  it('ante otro error no invalida el usuario actual', async () => {
    vi.mocked(adminService.changeUserRole).mockRejectedValue(errorConStatus('Último admin', 409))
    const { Wrapper, client } = createQueryWrapper()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useChangeUserRole(), { wrapper: Wrapper })

    act(() => result.current.mutate({ id: 4, role: 'usuario_regular' }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: CURRENT_USER_QUERY_KEY })
  })
})
