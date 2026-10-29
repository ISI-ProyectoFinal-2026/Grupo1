import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as reportsService from '@/services/reports.service'
import { useUpdateReport } from '@/hooks/useUpdateReport'
import { reportDetailQueryKey } from '@/hooks/useReportDetailQuery'
import { reportMatchesQueryKey } from '@/hooks/useReportMatchesQuery'
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

describe('useUpdateReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guarda los cambios y deja el detalle actualizado en cache', async () => {
    const editado = reporte({ title: 'Perra encontrada en Caballito' })
    vi.mocked(reportsService.updateReport).mockResolvedValue(editado)
    const { Wrapper, client } = createQueryWrapper()
    const { result } = renderHook(() => useUpdateReport(5), { wrapper: Wrapper })

    let devuelto: ReportDTO | undefined
    await act(async () => {
      devuelto = await result.current.update({ title: 'Perra encontrada en Caballito' })
    })

    expect(reportsService.updateReport).toHaveBeenCalledWith(5, {
      title: 'Perra encontrada en Caballito',
    })
    expect(devuelto).toEqual(editado)
    expect(client.getQueryData(reportDetailQueryKey(5))).toEqual(editado)
  })

  it('invalida el feed y las coincidencias del reporte', async () => {
    vi.mocked(reportsService.updateReport).mockResolvedValue(reporte())
    const { Wrapper, client } = createQueryWrapper()
    const invalidar = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateReport(5), { wrapper: Wrapper })

    await act(async () => {
      await result.current.update({ title: 'Otro titulo' })
    })

    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['reports'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: reportMatchesQueryKey(5) })
  })

  it('propaga el error de la API para que el formulario lo muestre', async () => {
    vi.mocked(reportsService.updateReport).mockRejectedValue(
      new Error('No se puede cambiar la foto de un reporte resuelto')
    )
    const { Wrapper } = createQueryWrapper()
    const { result } = renderHook(() => useUpdateReport(5), { wrapper: Wrapper })

    await expect(
      act(() => result.current.update({ imageUrl: 'https://cdn/nueva.jpg' }))
    ).rejects.toThrow('No se puede cambiar la foto de un reporte resuelto')
  })
})
