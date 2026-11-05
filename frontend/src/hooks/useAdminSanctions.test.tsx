import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDecideSanction, usePendingSanctions } from '@/hooks/useAdminSanctions'
import * as adminService from '@/services/admin.service'
import { createQueryWrapper } from '@/test/query-wrapper'

vi.mock('@/services/admin.service')

const decision = { id: 12, status: 'active', kind: 'permanent', endsAt: null } as const

describe('usePendingSanctions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('consulta la cola pendiente', async () => {
    vi.mocked(adminService.listPendingSanctions).mockResolvedValue({ items: [] })
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => usePendingSanctions(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data).toEqual({ items: [] }))
  })
})

describe('useDecideSanction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirma con el motivo e invalida la cola', async () => {
    vi.mocked(adminService.confirmSanction).mockResolvedValue(decision)
    const { Wrapper, client } = createQueryWrapper()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useDecideSanction(), { wrapper: Wrapper })

    act(() => result.current.mutate({ id: 12, action: 'confirm', reason: 'Motivo' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(adminService.confirmSanction).toHaveBeenCalledWith(12, 'Motivo')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'sanctions'] })
  })

  it('revierte con el motivo', async () => {
    vi.mocked(adminService.revertSanction).mockResolvedValue({ ...decision, status: 'reverted' })
    const { Wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useDecideSanction(), { wrapper: Wrapper })

    act(() => result.current.mutate({ id: 12, action: 'revert', reason: 'Motivo' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(adminService.revertSanction).toHaveBeenCalledWith(12, 'Motivo')
  })

  // otro admin decidió antes: refrescar la cola para sacar el caso
  it('ante un 409 también refresca la cola', async () => {
    vi.mocked(adminService.confirmSanction).mockRejectedValue(
      Object.assign(new Error('El caso ya fue decidido'), { status: 409 })
    )
    const { Wrapper, client } = createQueryWrapper()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useDecideSanction(), { wrapper: Wrapper })

    act(() => result.current.mutate({ id: 12, action: 'confirm', reason: 'Motivo' }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'sanctions'] })
  })
})
