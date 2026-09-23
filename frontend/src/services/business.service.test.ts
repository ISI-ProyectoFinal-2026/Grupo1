import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import {
  contactBusiness,
  createBusiness,
  getBusiness,
  getMyBusiness,
  getMyBusinessStats,
  listBusinesses,
  updateMyBusiness,
} from '@/services/business.service'
import type { Business, PublicBusiness } from '@/types/business.types'

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

function comercioPublico(overrides: Partial<PublicBusiness> = {}): PublicBusiness {
  return {
    id: 1,
    name: 'Veterinaria San Roque',
    address: 'Av. Siempre Viva 123',
    phone: '1122334455',
    category: 'VETERINARIA',
    plan: 'FREE',
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

  it('lista el directorio desde GET /businesses sin filtro cuando no hay categoria', async () => {
    const listado = [comercioPublico()]
    vi.mocked(api.get).mockResolvedValue(respuesta(listado))

    const resultado = await listBusinesses()

    expect(api.get).toHaveBeenCalledWith('/businesses', { params: undefined })
    expect(resultado).toEqual(listado)
  })

  it('filtra el directorio por categoria contra GET /businesses', async () => {
    vi.mocked(api.get).mockResolvedValue(respuesta([comercioPublico()]))

    await listBusinesses('REFUGIO')

    expect(api.get).toHaveBeenCalledWith('/businesses', { params: { category: 'REFUGIO' } })
  })

  it('trae el perfil publico desde GET /businesses/:id', async () => {
    const publico = comercioPublico({ id: 9 })
    vi.mocked(api.get).mockResolvedValue(respuesta(publico))

    const resultado = await getBusiness(9)

    expect(api.get).toHaveBeenCalledWith('/businesses/9')
    expect(resultado).toEqual(publico)
  })

  it('registra el contacto contra POST /businesses/:id/contact', async () => {
    vi.mocked(api.post).mockResolvedValue(respuesta(undefined))

    await contactBusiness(9)

    expect(api.post).toHaveBeenCalledWith('/businesses/9/contact')
  })
})
