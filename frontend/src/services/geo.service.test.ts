import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import { listMapReports, reverseGeocode } from '@/services/geo.service'
import type { ReportDTO } from '@/types/report.types'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn() },
}))

const bounds = { swLat: -34.7, swLng: -68.4, neLat: -34.5, neLng: -68.2 }

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

beforeEach(() => vi.clearAllMocks())

describe('reverseGeocode', () => {
  it('pide /geo/reverse con lat y lng y devuelve la direccion', async () => {
    vi.mocked(api.get).mockResolvedValue(respuesta({ address: 'San Rafael' }))
    const { signal } = new AbortController()

    await expect(reverseGeocode(-34.61, -68.33, signal)).resolves.toBe('San Rafael')

    expect(api.get).toHaveBeenCalledWith('/geo/reverse', {
      params: { lat: -34.61, lng: -68.33 },
      signal,
    })
  })

  it('devuelve null si el backend no encontro ciudad ni localidad', async () => {
    vi.mocked(api.get).mockResolvedValue(respuesta({ address: null }))

    await expect(reverseGeocode(-34.61, -68.33)).resolves.toBeNull()
  })
})

describe('listMapReports', () => {
  it('pide /geo/map con bounds como "swLat,swLng,neLat,neLng"', async () => {
    vi.mocked(api.get).mockResolvedValue(respuesta<ReportDTO[]>([]))

    await listMapReports(bounds)

    expect(api.get).toHaveBeenCalledWith('/geo/map', {
      params: { bounds: '-34.7,-68.4,-34.5,-68.2' },
      signal: undefined,
    })
  })

  it('manda los filtros del feed junto con el area y la señal de cancelacion', async () => {
    vi.mocked(api.get).mockResolvedValue(respuesta<ReportDTO[]>([]))
    const { signal } = new AbortController()

    await listMapReports(bounds, { type: 'lost', zone: 'Centro', dateFrom: '2026-09-01' }, signal)

    expect(api.get).toHaveBeenCalledWith('/geo/map', {
      params: { type: 'lost', zone: 'Centro', dateFrom: '2026-09-01', bounds: '-34.7,-68.4,-34.5,-68.2' },
      signal,
    })
  })

  it('devuelve los reportes de la respuesta', async () => {
    const reports = [{ id: 1 }] as ReportDTO[]
    vi.mocked(api.get).mockResolvedValue(respuesta(reports))

    await expect(listMapReports(bounds)).resolves.toBe(reports)
  })
})
