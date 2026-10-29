import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as reportsService from '@/services/reports.service'
import { useDeleteReport } from '@/hooks/useDeleteReport'
import { reportDetailQueryKey } from '@/hooks/useReportDetailQuery'

vi.mock('@/services/reports.service')

function errorConStatus(message: string, status: number) {
  return Object.assign(new Error(message), { status })
}

describe('useDeleteReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('elimina el reporte, limpia su detalle, invalida el feed y avisa', async () => {
    vi.mocked(reportsService.deleteReport).mockResolvedValue(undefined)
    const { Wrapper, client } = createQueryWrapper()
    client.setQueryData(reportDetailQueryKey(5), { id: 5 })
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const onDeleted = vi.fn()
    const { result } = renderHook(() => useDeleteReport(5, onDeleted), { wrapper: Wrapper })

    act(() => result.current.remove())

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
    expect(reportsService.deleteReport).toHaveBeenCalledWith(5)
    expect(client.getQueryData(reportDetailQueryKey(5))).toBeUndefined()
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['reports'] })
    expect(result.current.error).toBeNull()
  })

  it('ante un error de la API expone su mensaje', async () => {
    vi.mocked(reportsService.deleteReport).mockRejectedValue(
      errorConStatus('No tenés permiso para eliminar este reporte', 403)
    )
    const { Wrapper } = createQueryWrapper()
    const onDeleted = vi.fn()
    const { result } = renderHook(() => useDeleteReport(5, onDeleted), { wrapper: Wrapper })

    act(() => result.current.remove())

    await waitFor(() =>
      expect(result.current.error).toBe('No tenés permiso para eliminar este reporte')
    )
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('ante un error del servidor muestra un mensaje generico', async () => {
    vi.mocked(reportsService.deleteReport).mockRejectedValue(
      errorConStatus('Error interno del servidor', 500)
    )
    const { Wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useDeleteReport(5, vi.fn()), { wrapper: Wrapper })

    act(() => result.current.remove())

    await waitFor(() =>
      expect(result.current.error).toBe('No se pudo eliminar el reporte, intentá de nuevo.')
    )
  })
})
