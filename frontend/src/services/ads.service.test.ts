import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import { createAd, deleteAd, getAdStats, listMyAds, setAdStatus, updateAd } from '@/services/ads.service'
import type { Ad } from '@/types/ad.types'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const respuesta = <T,>(data: T) => ({ data }) as AxiosResponse<T>

const anuncio: Ad = {
  id: 4,
  businessId: 1,
  title: 'Vacunación',
  body: '20% off',
  imageUrl: 'https://pub.r2.dev/a.jpg',
  radiusKm: 5,
  status: 'ACTIVE',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
}

const input = { title: 'Vacunación', body: '20% off', imageUrl: 'https://pub.r2.dev/a.jpg', radiusKm: 5 }

describe('ads.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista los anuncios propios', async () => {
    vi.mocked(api.get).mockResolvedValue(respuesta([anuncio]))
    expect(await listMyAds()).toEqual([anuncio])
    expect(api.get).toHaveBeenCalledWith('/businesses/me/ads')
  })

  it('crea un anuncio', async () => {
    vi.mocked(api.post).mockResolvedValue(respuesta(anuncio))
    expect(await createAd(input)).toEqual(anuncio)
    expect(api.post).toHaveBeenCalledWith('/businesses/me/ads', input)
  })

  it('edita un anuncio', async () => {
    vi.mocked(api.put).mockResolvedValue(respuesta(anuncio))
    await updateAd(4, { title: 'Nuevo' })
    expect(api.put).toHaveBeenCalledWith('/businesses/me/ads/4', { title: 'Nuevo' })
  })

  it('pausa o activa un anuncio', async () => {
    vi.mocked(api.patch).mockResolvedValue(respuesta({ ...anuncio, status: 'PAUSED' }))
    await setAdStatus(4, 'PAUSED')
    expect(api.patch).toHaveBeenCalledWith('/businesses/me/ads/4/status', { status: 'PAUSED' })
  })

  it('elimina un anuncio', async () => {
    vi.mocked(api.delete).mockResolvedValue(respuesta(undefined))
    await deleteAd(4)
    expect(api.delete).toHaveBeenCalledWith('/businesses/me/ads/4')
  })

  it('trae las métricas de un anuncio', async () => {
    const stats = { impressions: 4, clicks: 1, ctr: 0.25, daily: [], byPlacement: [] }
    vi.mocked(api.get).mockResolvedValue(respuesta(stats))
    expect(await getAdStats(4)).toEqual(stats)
    expect(api.get).toHaveBeenCalledWith('/businesses/me/ads/4/stats')
  })
})
