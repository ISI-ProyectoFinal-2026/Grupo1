import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as moderationService from '@/services/moderation.service'
import {
  reportFlagsQueryKey,
  useReportFlagsQuery,
  useResolveReportFlagMutation,
} from '@/hooks/useReportFlagsQuery'
import type { ReportFlagDTO } from '@/types/moderation.types'

vi.mock('@/services/moderation.service')

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

describe('useReportFlagsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trae la cola de flags pendientes', async () => {
    const esperados = [flag(), flag({ id: 2 })]
    vi.mocked(moderationService.listReportFlags).mockResolvedValue(esperados)
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useReportFlagsQuery(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(moderationService.listReportFlags).toHaveBeenCalledWith('pending')
    expect(result.current.data).toEqual(esperados)
  })
})

describe('useResolveReportFlagMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resuelve el flag e invalida la cola para que el resuelto desaparezca', async () => {
    vi.mocked(moderationService.resolveReportFlag).mockResolvedValue(flag({ status: 'reviewed' }))
    const { Wrapper, client } = createQueryWrapper()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useResolveReportFlagMutation(), { wrapper: Wrapper })
    result.current.mutate(42)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(moderationService.resolveReportFlag).toHaveBeenCalledWith(42)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: reportFlagsQueryKey })
  })
})
