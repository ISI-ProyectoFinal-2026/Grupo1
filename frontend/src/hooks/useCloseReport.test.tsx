import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as reportsService from '@/services/reports.service'
import { useCloseReport } from '@/hooks/useCloseReport'
import { useReportDetailQuery } from '@/hooks/useReportDetailQuery'
import type { ReportDTO } from '@/types/report.types'

vi.mock('@/services/reports.service')

function reporte(overrides: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: 5,
    userId: 7,
    petId: null,
    reportType: 'lost',
    status: 'published',
    title: 'Perra perdida en Caballito',
    description: null,
    imageUrl: null,
    customFlyerUrl: null,
    locationAddress: null,
    location: null,
    tag: { label: 'PERDIDO', color: '#EF4444' },
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '2026-09-19T10:00:00.000Z',
    publishedAt: '2026-09-19T10:05:00.000Z',
    ...overrides,
  }
}

function errorConStatus(message: string, status: number) {
  return Object.assign(new Error(message), { status })
}

function renderConDetalle(reportId = 5) {
  const { Wrapper } = createQueryWrapper()
  return renderHook(
    () => ({
      detalle: useReportDetailQuery(reportId),
      cierre: useCloseReport(reportId),
    }),
    { wrapper: Wrapper }
  )
}

describe('useCloseReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte())
  })

  it('cierra el reporte y deja el detalle en resolved', async () => {
    vi.mocked(reportsService.closeReport).mockResolvedValue(reporte({ status: 'resolved' }))
    const { result } = renderConDetalle()
    await waitFor(() => expect(result.current.detalle.isSuccess).toBe(true))

    act(() => result.current.cierre.close())

    await waitFor(() => expect(result.current.detalle.data?.status).toBe('resolved'))
    expect(reportsService.closeReport).toHaveBeenCalledWith(5)
    expect(result.current.cierre.error).toBeNull()
  })

  it('ante un 409 avisa que el reporte ya estaba cerrado', async () => {
    vi.mocked(reportsService.closeReport).mockRejectedValue(
      errorConStatus('El reporte ya está resuelto', 409)
    )
    const { result } = renderConDetalle()

    act(() => result.current.cierre.close())

    await waitFor(() =>
      expect(result.current.cierre.error).toBe('Este reporte ya estaba cerrado.')
    )
  })

  it('ante un 409 vuelve a pedir el detalle para mostrar el estado real', async () => {
    vi.mocked(reportsService.closeReport).mockRejectedValue(
      errorConStatus('El reporte ya está resuelto', 409)
    )
    const { result } = renderConDetalle()
    await waitFor(() => expect(result.current.detalle.isSuccess).toBe(true))
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte({ status: 'resolved' }))

    act(() => result.current.cierre.close())

    await waitFor(() => expect(result.current.detalle.data?.status).toBe('resolved'))
  })

  it('ante otro error expone el mensaje de la API', async () => {
    vi.mocked(reportsService.closeReport).mockRejectedValue(
      errorConStatus('No tenés permiso para cerrar este reporte', 403)
    )
    const { result } = renderConDetalle()

    act(() => result.current.cierre.close())

    await waitFor(() =>
      expect(result.current.cierre.error).toBe('No tenés permiso para cerrar este reporte')
    )
  })
})
