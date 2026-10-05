import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import { createReportFlag, listReportFlags, resolveReportFlag } from '@/services/moderation.service'
import type { CreatedReportFlagDTO, ReportFlagDTO } from '@/types/moderation.types'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

function flag(overrides: Partial<ReportFlagDTO> = {}): ReportFlagDTO {
  return {
    id: 1,
    reportId: 10,
    userId: 7,
    reason: 'Publicacion falsa',
    status: 'pending',
    createdAt: '2026-09-01T10:00:00.000Z',
    report: { id: 10, title: 'Perrito en Plaza de Mayo', status: 'published' },
    ...overrides,
  }
}

describe('moderation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista los flags pendientes por defecto, sin mandar el filtro', async () => {
    const esperados = [flag(), flag({ id: 2 })]
    vi.mocked(api.get).mockResolvedValue(respuesta(esperados))

    const resultado = await listReportFlags()

    expect(api.get).toHaveBeenCalledWith('/report-flags', { params: {} })
    expect(resultado).toEqual(esperados)
  })

  it('manda status como query param cuando se pide un estado', async () => {
    vi.mocked(api.get).mockResolvedValue(respuesta([flag({ status: 'reviewed' })]))

    await listReportFlags('reviewed')

    expect(api.get).toHaveBeenCalledWith('/report-flags', { params: { status: 'reviewed' } })
  })

  it('resuelve un flag con PATCH y sin cuerpo', async () => {
    const resuelto = flag({
      status: 'reviewed',
      report: { id: 10, title: 'X', status: 'rejected' },
    })
    vi.mocked(api.patch).mockResolvedValue(respuesta(resuelto))

    const resultado = await resolveReportFlag(1)

    expect(api.patch).toHaveBeenCalledWith('/report-flags/1')
    expect(resultado.status).toBe('reviewed')
    expect(resultado.report.status).toBe('rejected')
  })

  it('denuncia un reporte contra POST /reports/:id/flags con el motivo', async () => {
    const creado: CreatedReportFlagDTO = {
      id: 3,
      reportId: 5,
      userId: 7,
      reason: 'Es una estafa',
      status: 'pending',
      createdAt: '2026-09-01T10:00:00.000Z',
    }
    vi.mocked(api.post).mockResolvedValue(respuesta(creado))

    const resultado = await createReportFlag(5, 'Es una estafa')

    expect(api.post).toHaveBeenCalledWith('/reports/5/flags', { reason: 'Es una estafa' })
    expect(resultado).toEqual(creado)
  })
})
