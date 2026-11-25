import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as reportsService from '@/services/reports.service'
import { useReportFlyer } from '@/hooks/useReportFlyer'

vi.mock('@/services/reports.service')

function renderFlyer(onGenerated = vi.fn()) {
  const { Wrapper } = createQueryWrapper()
  const hook = renderHook(() => useReportFlyer(5, onGenerated), { wrapper: Wrapper })
  return { ...hook, onGenerated }
}

describe('useReportFlyer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('genera el flyer del reporte y entrega su url', async () => {
    vi.mocked(reportsService.getFlyer).mockResolvedValue({ flyerUrl: 'https://cdn/flyer-5.png' })
    const { result, onGenerated } = renderFlyer()

    act(() => result.current.generate())

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith('https://cdn/flyer-5.png'))
    expect(reportsService.getFlyer).toHaveBeenCalledWith(5)
    expect(result.current.isError).toBe(false)
  })

  it('queda en curso mientras se genera', async () => {
    vi.mocked(reportsService.getFlyer).mockReturnValue(new Promise(() => {}))
    const { result } = renderFlyer()

    act(() => result.current.generate())

    await waitFor(() => expect(result.current.isPending).toBe(true))
  })

  it('si falla marca el error y no entrega url', async () => {
    vi.mocked(reportsService.getFlyer).mockRejectedValue(new Error('Request failed'))
    const { result, onGenerated } = renderFlyer()

    act(() => result.current.generate())

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(onGenerated).not.toHaveBeenCalled()
  })
})
