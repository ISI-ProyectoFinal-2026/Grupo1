import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as businessService from '@/services/business.service'
import {
  hasNoBusiness,
  useCreateBusinessMutation,
  useMyBusinessQuery,
  useMyBusinessStatsQuery,
  useUpdateBusinessMutation,
} from '@/hooks/useBusiness'
import type { Business } from '@/types/business.types'

vi.mock('@/services/business.service')

function comercio(overrides: Partial<Business> = {}): Business {
  return {
    id: 1,
    userId: 7,
    name: 'Veterinaria San Roque',
    cuit: '20-12345678-9',
    address: 'Av. Siempre Viva 123',
    phone: '1122334455',
    category: 'VETERINARIA',
    plan: 'FREE',
    planExpiresAt: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('hasNoBusiness', () => {
  it('es true para un error 404', () => {
    expect(hasNoBusiness(Object.assign(new Error('x'), { status: 404 }))).toBe(true)
  })

  it('es false para otros errores o sin error', () => {
    expect(hasNoBusiness(Object.assign(new Error('x'), { status: 500 }))).toBe(false)
    expect(hasNoBusiness(undefined)).toBe(false)
  })
})

describe('useMyBusinessQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trae el comercio del usuario logueado', async () => {
    const propio = comercio()
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(propio)
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useMyBusinessQuery(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(propio)
  })

  it('no reintenta cuando el usuario no tiene comercio (404)', async () => {
    vi.mocked(businessService.getMyBusiness).mockRejectedValue(
      Object.assign(new Error('Comercio no encontrado'), { status: 404 })
    )
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useMyBusinessQuery(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(businessService.getMyBusiness).toHaveBeenCalledTimes(1)
  })
})

describe('useMyBusinessStatsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trae las estadisticas cuando esta habilitado', async () => {
    vi.mocked(businessService.getMyBusinessStats).mockResolvedValue({ views: 4, contacts: 2 })
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useMyBusinessStatsQuery(true), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ views: 4, contacts: 2 })
  })

  it('no consulta cuando esta deshabilitado', () => {
    vi.mocked(businessService.getMyBusinessStats).mockResolvedValue({ views: 0, contacts: 0 })
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useMyBusinessStatsQuery(false), { wrapper: Wrapper })

    expect(businessService.getMyBusinessStats).not.toHaveBeenCalled()
  })
})

describe('mutaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crear comercio deja el resultado disponible para useMyBusinessQuery', async () => {
    const creado = comercio({ plan: 'PREMIUM' })
    vi.mocked(businessService.getMyBusiness).mockRejectedValue(
      Object.assign(new Error('Comercio no encontrado'), { status: 404 })
    )
    vi.mocked(businessService.createBusiness).mockResolvedValue(creado)
    const { Wrapper, client } = createQueryWrapper()

    const { result } = renderHook(
      () => ({ query: useMyBusinessQuery(), crear: useCreateBusinessMutation() }),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.query.isError).toBe(true))

    result.current.crear.mutate({
      name: creado.name,
      cuit: creado.cuit,
      address: creado.address,
      phone: creado.phone,
      category: creado.category,
      plan: 'PREMIUM',
    })

    await waitFor(() => expect(result.current.crear.isSuccess).toBe(true))
    expect(client.getQueryData(['business', 'me'])).toEqual(creado)
  })

  it('actualizar comercio refresca el cache de useMyBusinessQuery', async () => {
    const original = comercio()
    const actualizado = comercio({ phone: '1199998888' })
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(original)
    vi.mocked(businessService.updateMyBusiness).mockResolvedValue(actualizado)
    const { Wrapper, client } = createQueryWrapper()

    const { result } = renderHook(
      () => ({ query: useMyBusinessQuery(), actualizar: useUpdateBusinessMutation() }),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))

    result.current.actualizar.mutate({ phone: '1199998888' })

    await waitFor(() => expect(result.current.actualizar.isSuccess).toBe(true))
    expect(client.getQueryData(['business', 'me'])).toEqual(actualizado)
  })
})
