import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as moderationService from '@/services/moderation.service'
import {
  reportFlagGroupsQueryKey,
  useModerateReportMutation,
  useReportFlagGroupsQuery,
} from '@/hooks/useReportFlagGroups'
import type { ReportFlagGroupDTO } from '@/types/moderation.types'

vi.mock('@/services/moderation.service')

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
    flagCount: 1,
    reasonCounts: { spam: 1 },
    otherDetails: [],
    lastFlaggedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('useReportFlagGroupsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trae la cola agrupada', async () => {
    const esperados = [group(), group({ flagCount: 3 })]
    vi.mocked(moderationService.listReportFlagGroups).mockResolvedValue(esperados)
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useReportFlagGroupsQuery(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(esperados)
  })
})

describe('useModerateReportMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aplica la accion e invalida la cola para refrescarla', async () => {
    vi.mocked(moderationService.moderateReport).mockResolvedValue({ id: 42, status: 'published' })
    const { Wrapper, client } = createQueryWrapper()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useModerateReportMutation(), { wrapper: Wrapper })
    result.current.mutate({ reportId: 42, action: 'dismiss' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(moderationService.moderateReport).toHaveBeenCalledWith(42, 'dismiss')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: reportFlagGroupsQueryKey })
  })

  it('refresca la cola tambien cuando la accion falla (otro moderador ya resolvio)', async () => {
    vi.mocked(moderationService.moderateReport).mockRejectedValue(new Error('Este reporte ya fue revisado'))
    const { Wrapper, client } = createQueryWrapper()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useModerateReportMutation(), { wrapper: Wrapper })
    result.current.mutate({ reportId: 42, action: 'hide' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: reportFlagGroupsQueryKey })
  })
})
