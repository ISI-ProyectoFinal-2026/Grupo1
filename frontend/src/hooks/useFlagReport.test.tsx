import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as moderationService from '@/services/moderation.service'
import { useFlagReport } from '@/hooks/useFlagReport'

vi.mock('@/services/moderation.service')

function errorConStatus(message: string, status: number) {
  return Object.assign(new Error(message), { status })
}

function renderFlag(reportId = 5) {
  const { Wrapper } = createQueryWrapper()
  return renderHook(() => useFlagReport(reportId), { wrapper: Wrapper })
}

describe('useFlagReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('denuncia el reporte con el motivo y queda como enviada', async () => {
    vi.mocked(moderationService.createReportFlag).mockResolvedValue({
      id: 3,
      reportId: 5,
      userId: 8,
      reason: 'Es una estafa',
      status: 'pending',
      createdAt: '2026-09-01T10:00:00.000Z',
    })
    const { result } = renderFlag()

    act(() => result.current.flag('Es una estafa'))

    await waitFor(() => expect(result.current.isSent).toBe(true))
    expect(moderationService.createReportFlag).toHaveBeenCalledWith(5, 'Es una estafa')
    expect(result.current.isDone).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('ante un 409 avisa que ya lo denunció y no deja volver a intentar', async () => {
    vi.mocked(moderationService.createReportFlag).mockRejectedValue(
      errorConStatus('Ya reportaste esta publicación', 409)
    )
    const { result } = renderFlag()

    act(() => result.current.flag('Es una estafa'))

    await waitFor(() => expect(result.current.error).toBe('Ya denunciaste este reporte.'))
    expect(result.current.isDone).toBe(true)
    expect(result.current.isSent).toBe(false)
  })

  it('ante otro error expone el mensaje de la API y permite reintentar', async () => {
    vi.mocked(moderationService.createReportFlag).mockRejectedValue(
      errorConStatus('Error inesperado, intentá de nuevo', 500)
    )
    const { result } = renderFlag()

    act(() => result.current.flag('Es una estafa'))

    await waitFor(() => expect(result.current.error).toBe('Error inesperado, intentá de nuevo'))
    expect(result.current.isDone).toBe(false)
  })
})
