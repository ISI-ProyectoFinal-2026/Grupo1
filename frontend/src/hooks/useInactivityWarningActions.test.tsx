import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as reportsService from '@/services/reports.service'
import { useInactivityWarningActions } from '@/hooks/useInactivityWarningActions'
import type { ReportDTO } from '@/types/report.types'

vi.mock('@/services/reports.service')

const reporte = { id: 5, status: 'published' } as ReportDTO

function errorConStatus(message: string, status: number) {
  return Object.assign(new Error(message), { status })
}

function render() {
  const { Wrapper, client } = createQueryWrapper()
  const spy = vi.spyOn(client, 'invalidateQueries')
  const hook = renderHook(() => useInactivityWarningActions(5), { wrapper: Wrapper })
  return { ...hook, spy }
}

describe('useInactivityWarningActions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('seguir mostrando llama al servicio e invalida notificaciones, reporte y mis reportes', async () => {
    vi.mocked(reportsService.keepReportActive).mockResolvedValue(reporte)
    const { result, spy } = render()

    act(() => result.current.keep())

    await waitFor(() => expect(result.current.done).toBe(true))
    expect(reportsService.keepReportActive).toHaveBeenCalledWith(5)
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey)
    expect(keys).toEqual(
      expect.arrayContaining([['notifications'], ['report', 5], ['reports', 'mine']])
    )
  })

  it('caso resuelto cierra el reporte e invalida las mismas consultas', async () => {
    vi.mocked(reportsService.closeReport).mockResolvedValue({ ...reporte, status: 'resolved' })
    const { result, spy } = render()

    act(() => result.current.close())

    await waitFor(() => expect(result.current.done).toBe(true))
    expect(reportsService.closeReport).toHaveBeenCalledWith(5)
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey)
    expect(keys).toEqual(
      expect.arrayContaining([['notifications'], ['report', 5], ['reports', 'mine']])
    )
  })

  it('ante un 409 da la accion por terminada, avisa e invalida', async () => {
    vi.mocked(reportsService.keepReportActive).mockRejectedValue(errorConStatus('conflicto', 409))
    const { result, spy } = render()

    act(() => result.current.keep())

    await waitFor(() => expect(result.current.done).toBe(true))
    expect(result.current.error).toBe('Este reporte ya no está publicado.')
    expect(spy).toHaveBeenCalled()
  })

  it('ante otro error expone el mensaje y no da la accion por terminada', async () => {
    vi.mocked(reportsService.closeReport).mockRejectedValue(errorConStatus('Sin permiso', 403))
    const { result } = render()

    act(() => result.current.close())

    await waitFor(() => expect(result.current.error).toBe('Sin permiso'))
    expect(result.current.done).toBe(false)
  })
})
