import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import { createReportFlag, listReportFlagGroups, moderateReport } from '@/services/moderation.service'
import type { CreatedReportFlagDTO, ReportFlagGroupDTO } from '@/types/moderation.types'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

function group(overrides: Partial<ReportFlagGroupDTO> = {}): ReportFlagGroupDTO {
  return {
    report: {
      id: 10,
      title: 'Perrito en Plaza de Mayo',
      status: 'published',
      reportType: 'lost',
      imageUrl: null,
      description: null,
    },
    flagCount: 2,
    reasonCounts: { spam: 1, other: 1 },
    otherDetails: ['Es una estafa'],
    lastFlaggedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('moderation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista la cola agrupada por reporte', async () => {
    const esperados = [group(), group({ flagCount: 5 })]
    vi.mocked(api.get).mockResolvedValue(respuesta(esperados))

    const resultado = await listReportFlagGroups()

    expect(api.get).toHaveBeenCalledWith('/report-flags/reports')
    expect(resultado).toEqual(esperados)
  })

  it.each(['hide', 'dismiss', 'restore', 'confirm'] as const)(
    'aplica la accion %s sobre el reporte con PATCH',
    async (action) => {
      vi.mocked(api.patch).mockResolvedValue(respuesta({ id: 10, status: 'hidden' }))

      const resultado = await moderateReport(10, action)

      expect(api.patch).toHaveBeenCalledWith('/report-flags/reports/10', { action })
      expect(resultado).toEqual({ id: 10, status: 'hidden' })
    }
  )

  it('denuncia un reporte contra POST /reports/:id/flags con el motivo', async () => {
    const creado: CreatedReportFlagDTO = {
      id: 3,
      reportId: 5,
      userId: 7,
      reason: 'other',
      detail: 'Es una estafa',
      status: 'pending',
      createdAt: '2026-09-01T10:00:00.000Z',
    }
    vi.mocked(api.post).mockResolvedValue(respuesta(creado))

    const resultado = await createReportFlag(5, { reason: 'other', detail: 'Es una estafa' })

    expect(api.post).toHaveBeenCalledWith('/reports/5/flags', { reason: 'other', detail: 'Es una estafa' })
    expect(resultado).toEqual(creado)
  })
})
