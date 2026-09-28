import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import { confirmMatch, rejectMatch } from '@/services/reports.service'
import type { MatchDecisionDTO } from '@/types/report.types'

vi.mock('@/services/api', () => ({
  api: { post: vi.fn() },
}))

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

describe('reports.service coincidencias', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
