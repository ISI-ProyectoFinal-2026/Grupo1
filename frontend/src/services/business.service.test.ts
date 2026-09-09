import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import {
  createBusiness,
  getMyBusiness,
  getMyBusinessStats,
  updateMyBusiness,
} from '@/services/business.service'
import type { Business } from '@/types/business.types'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

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

describe('business.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea el comercio contra POST /businesses', async () => {
    const creado = comercio()
    vi.mocked(api.post).mockResolvedValue(respuesta(creado))

    const resultado = await createBusiness({
      name: creado.name,
      cuit: creado.cuit,
      address: creado.address,
      phone: creado.phone,
      category: creado.category,
      plan: 'FREE',
    })

    expect(api.post).toHaveBeenCalledWith('/businesses', {
      name: creado.name,
      cuit: creado.cuit,
      address: creado.address,
      phone: creado.phone,
      category: creado.category,
      plan: 'FREE',
    })
    expect(resultado).toEqual(creado)
  })

  it('trae el comercio propio desde GET /businesses/me', async () => {
    const propio = comercio()
    vi.mocked(api.get).mockResolvedValue(respuesta(propio))

    const resultado = await getMyBusiness()

    expect(api.get).toHaveBeenCalledWith('/businesses/me')
    expect(resultado).toEqual(propio)
  })

  it('actualiza el comercio propio contra PUT /businesses/me', async () => {
    const actualizado = comercio({ plan: 'PREMIUM' })
    vi.mocked(api.put).mockResolvedValue(respuesta(actualizado))

    const resultado = await updateMyBusiness({ plan: 'PREMIUM' })

    expect(api.put).toHaveBeenCalledWith('/businesses/me', { plan: 'PREMIUM' })
    expect(resultado.plan).toBe('PREMIUM')
  })

  it('trae las estadisticas propias desde GET /businesses/me/stats', async () => {
    const stats = { views: 3, contacts: 1 }
    vi.mocked(api.get).mockResolvedValue(respuesta(stats))

    const resultado = await getMyBusinessStats()

    expect(api.get).toHaveBeenCalledWith('/businesses/me/stats')
    expect(resultado).toEqual(stats)
  })
})
