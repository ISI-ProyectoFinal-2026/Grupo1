import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import {
  closeReport,
  confirmMatch,
  createReport,
  deleteReport,
  getFlyer,
  getMatches,
  getReport,
  listReports,
  rejectMatch,
  updateReport,
  uploadCustomFlyer,
} from '@/services/reports.service'
import type { MatchDTO, MatchDecisionDTO, ReportDTO } from '@/types/report.types'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

function reporte(overrides: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: 5,
    userId: 7,
    petId: null,
    reportType: 'lost',
    status: 'published',
    title: 'Perro perdido en Nueva Cordoba',
    description: null,
    imageUrl: null,
    customFlyerUrl: null,
    locationAddress: null,
    location: { lat: -31.42, lng: -64.18 },
    tag: { label: 'Perdido', color: 'red' },
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    publishedAt: '2026-09-20T10:00:00.000Z',
    ...overrides,
  }
}

describe('reports.service listado y detalle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista sin filtros contra GET /reports', async () => {
    const listado = [reporte()]
    vi.mocked(api.get).mockResolvedValue(respuesta(listado))

    const resultado = await listReports()

    expect(api.get).toHaveBeenCalledWith('/reports', { params: undefined })
    expect(resultado).toEqual(listado)
  })

  it('reenvia los filtros como query params', async () => {
    vi.mocked(api.get).mockResolvedValue(respuesta([]))

    await listReports({ type: 'found', status: 'published', order: 'asc' })

    expect(api.get).toHaveBeenCalledWith('/reports', {
      params: { type: 'found', status: 'published', order: 'asc' },
    })
  })

  it('trae el detalle desde GET /reports/:id', async () => {
    const detalle = reporte({ id: 12 })
    vi.mocked(api.get).mockResolvedValue(respuesta(detalle))

    const resultado = await getReport(12)

    expect(api.get).toHaveBeenCalledWith('/reports/12')
    expect(resultado).toEqual(detalle)
  })
})

describe('reports.service escritura', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea el reporte contra POST /reports', async () => {
    const creado = reporte()
    vi.mocked(api.post).mockResolvedValue(respuesta(creado))
    const input = {
      reportType: 'lost' as const,
      title: creado.title,
      location: { lat: -31.42, lng: -64.18 },
    }

    const resultado = await createReport(input)

    expect(api.post).toHaveBeenCalledWith('/reports', input)
    expect(resultado).toEqual(creado)
  })

  it('actualiza parcialmente contra PUT /reports/:id', async () => {
    const actualizado = reporte({ title: 'Titulo corregido' })
    vi.mocked(api.put).mockResolvedValue(respuesta(actualizado))

    const resultado = await updateReport(5, { title: 'Titulo corregido' })

    expect(api.put).toHaveBeenCalledWith('/reports/5', { title: 'Titulo corregido' })
    expect(resultado.title).toBe('Titulo corregido')
  })

  it('elimina contra DELETE /reports/:id y no devuelve nada', async () => {
    vi.mocked(api.delete).mockResolvedValue(respuesta(undefined))

    await expect(deleteReport(5)).resolves.toBeUndefined()

    expect(api.delete).toHaveBeenCalledWith('/reports/5')
  })

  it('cierra el reporte contra POST /reports/:id/close', async () => {
    const cerrado = reporte({ status: 'resolved' })
    vi.mocked(api.post).mockResolvedValue(respuesta(cerrado))

    const resultado = await closeReport(5)

    expect(api.post).toHaveBeenCalledWith('/reports/5/close')
    expect(resultado.status).toBe('resolved')
  })
})

describe('reports.service coincidencias', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trae las coincidencias desde GET /reports/:id/matches', async () => {
    const coincidencias: MatchDTO[] = [
      {
        matchId: 9,
        reportId: 8,
        title: 'Perro encontrado en Guemes',
        imageUrl: null,
        reportType: 'found',
        similarityScore: 0.91,
        status: 'pending',
        createdAt: '2026-09-21T10:00:00.000Z',
      },
    ]
    vi.mocked(api.get).mockResolvedValue(respuesta(coincidencias))

    const resultado = await getMatches(5)

    expect(api.get).toHaveBeenCalledWith('/reports/5/matches')
    expect(resultado).toEqual(coincidencias)
  })

  it('confirma contra POST /reports/:id/matches/:matchId/confirm', async () => {
    const decision: MatchDecisionDTO = {
      matchId: 9,
      status: 'confirmed',
      confirmedAt: '2026-09-27T12:00:00.000Z',
    }
    vi.mocked(api.post).mockResolvedValue(respuesta(decision))

    const resultado = await confirmMatch(5, 9)

    expect(api.post).toHaveBeenCalledWith('/reports/5/matches/9/confirm')
    expect(resultado).toEqual(decision)
  })

  it('descarta contra POST /reports/:id/matches/:matchId/reject', async () => {
    const decision: MatchDecisionDTO = { matchId: 9, status: 'rejected', confirmedAt: null }
    vi.mocked(api.post).mockResolvedValue(respuesta(decision))

    const resultado = await rejectMatch(5, 9)

    expect(api.post).toHaveBeenCalledWith('/reports/5/matches/9/reject')
    expect(resultado).toEqual(decision)
  })
})

describe('reports.service flyer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pide el flyer generado a GET /reports/:id/flyer', async () => {
    vi.mocked(api.get).mockResolvedValue(respuesta({ flyerUrl: 'https://cdn/flyer-5.png' }))

    const resultado = await getFlyer(5)

    expect(api.get).toHaveBeenCalledWith('/reports/5/flyer')
    expect(resultado.flyerUrl).toBe('https://cdn/flyer-5.png')
  })

  it('sube el flyer propio contra PUT /reports/:id/flyer/custom', async () => {
    const conFlyer = reporte({ customFlyerUrl: 'https://cdn/propio.png' })
    vi.mocked(api.put).mockResolvedValue(respuesta(conFlyer))

    const resultado = await uploadCustomFlyer(5, 'https://cdn/propio.png')

    expect(api.put).toHaveBeenCalledWith('/reports/5/flyer/custom', {
      flyerUrl: 'https://cdn/propio.png',
    })
    expect(resultado.customFlyerUrl).toBe('https://cdn/propio.png')
  })
})
