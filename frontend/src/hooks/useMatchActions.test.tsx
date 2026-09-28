import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as reportsService from '@/services/reports.service'
import { useMatchActions } from '@/hooks/useMatchActions'
import { useReportMatchesQuery } from '@/hooks/useReportMatchesQuery'
import type { MatchDecisionDTO, MatchDTO } from '@/types/report.types'

vi.mock('@/services/reports.service')

function coincidencia(overrides: Partial<MatchDTO> = {}): MatchDTO {
  return {
    matchId: 9,
    reportId: 21,
    title: 'Perra encontrada en Caballito',
    imageUrl: null,
    reportType: 'found',
    similarityScore: 0.91,
    status: 'pending',
    createdAt: '2026-09-20T10:00:00.000Z',
    ...overrides,
  }
}

function renderConLista(reportId = 5) {
  const { Wrapper } = createQueryWrapper()
  return renderHook(
    () => ({
      lista: useReportMatchesQuery(reportId, 'published'),
      acciones: useMatchActions(reportId),
    }),
    { wrapper: Wrapper }
  )
}

// Promesa que el test resuelve a mano, para inspeccionar el estado en vuelo.
function diferida<T>() {
  let resolver: (value: T) => void = () => {}
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve
  })
  return { promesa, resolver }
}

describe('useMatchActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirmar llama al servicio y refresca las coincidencias del reporte', async () => {
    vi.mocked(reportsService.getMatches).mockResolvedValue([coincidencia()])
    vi.mocked(reportsService.confirmMatch).mockResolvedValue({
      matchId: 9,
      status: 'confirmed',
      confirmedAt: '2026-09-27T12:00:00.000Z',
    })
    const { result } = renderConLista()
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))

    vi.mocked(reportsService.getMatches).mockResolvedValue([coincidencia({ status: 'confirmed' })])
    act(() => result.current.acciones.confirm(9))

    await waitFor(() => expect(result.current.lista.data?.[0].status).toBe('confirmed'))
    expect(reportsService.confirmMatch).toHaveBeenCalledWith(5, 9)
  })

  it('descartar llama al servicio y refresca las coincidencias del reporte', async () => {
    vi.mocked(reportsService.getMatches).mockResolvedValue([coincidencia()])
    vi.mocked(reportsService.rejectMatch).mockResolvedValue({
      matchId: 9,
      status: 'rejected',
      confirmedAt: null,
    })
    const { result } = renderConLista()
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))

    vi.mocked(reportsService.getMatches).mockResolvedValue([])
    act(() => result.current.acciones.reject(9))

    await waitFor(() => expect(result.current.lista.data).toEqual([]))
    expect(reportsService.rejectMatch).toHaveBeenCalledWith(5, 9)
  })

  it('si la decisión falla (409: la otra parte ya decidió) igual refresca las coincidencias', async () => {
    vi.mocked(reportsService.getMatches).mockResolvedValue([coincidencia()])
    vi.mocked(reportsService.rejectMatch).mockRejectedValue(
      new Error('La coincidencia ya fue confirmada')
    )
    const { result } = renderConLista()
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))

    vi.mocked(reportsService.getMatches).mockResolvedValue([coincidencia({ status: 'confirmed' })])
    act(() => result.current.acciones.reject(9))

    await waitFor(() => expect(result.current.lista.data?.[0].status).toBe('confirmed'))
    expect(result.current.acciones.errorFor(9)).toBe('La coincidencia ya fue confirmada')
  })

  it('mientras una decisión está en curso, todas las coincidencias quedan ocupadas', async () => {
    const confirmacion = diferida<MatchDecisionDTO>()
    vi.mocked(reportsService.confirmMatch).mockReturnValue(confirmacion.promesa)
    vi.mocked(reportsService.getMatches).mockResolvedValue([])
    const { result } = renderConLista()
    expect(result.current.acciones.isBusy).toBe(false)

    act(() => result.current.acciones.confirm(9))

    // no solo la 9: confirmar/descartar otra en paralelo queda bloqueado
    await waitFor(() => expect(result.current.acciones.isBusy).toBe(true))

    act(() => confirmacion.resolver({ matchId: 9, status: 'confirmed', confirmedAt: null }))
    await waitFor(() => expect(result.current.acciones.isBusy).toBe(false))
  })

  it('sigue ocupada hasta que la lista refrescada llega, para no decidir sobre datos viejos', async () => {
    vi.mocked(reportsService.getMatches).mockResolvedValue([coincidencia()])
    vi.mocked(reportsService.confirmMatch).mockResolvedValue({
      matchId: 9,
      status: 'confirmed',
      confirmedAt: null,
    })
    const { result } = renderConLista()
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true))

    const refresco = diferida<MatchDTO[]>()
    vi.mocked(reportsService.getMatches).mockReturnValue(refresco.promesa)
    act(() => result.current.acciones.confirm(9))

    await waitFor(() => expect(reportsService.confirmMatch).toHaveBeenCalled())
    await waitFor(() => expect(reportsService.getMatches).toHaveBeenCalledTimes(2))
    expect(result.current.acciones.isBusy).toBe(true)

    act(() => refresco.resolver([coincidencia({ status: 'confirmed' })]))
    await waitFor(() => expect(result.current.acciones.isBusy).toBe(false))
    expect(result.current.lista.data?.[0].status).toBe('confirmed')
  })

  it('expone el mensaje de error de la API solo para esa coincidencia', async () => {
    vi.mocked(reportsService.getMatches).mockResolvedValue([])
    vi.mocked(reportsService.rejectMatch).mockRejectedValue(
      new Error('La coincidencia ya fue confirmada')
    )
    const { result } = renderConLista()

    act(() => result.current.acciones.reject(9))

    await waitFor(() =>
      expect(result.current.acciones.errorFor(9)).toBe('La coincidencia ya fue confirmada')
    )
    expect(result.current.acciones.errorFor(10)).toBeNull()
  })

  it('al reintentar con la otra acción, no queda el error viejo de esa coincidencia', async () => {
    vi.mocked(reportsService.getMatches).mockResolvedValue([])
    vi.mocked(reportsService.rejectMatch).mockRejectedValue(new Error('Error inesperado'))
    const confirmacion = diferida<MatchDecisionDTO>()
    vi.mocked(reportsService.confirmMatch).mockReturnValue(confirmacion.promesa)
    const { result } = renderConLista()

    act(() => result.current.acciones.reject(9))
    await waitFor(() => expect(result.current.acciones.errorFor(9)).toBe('Error inesperado'))

    act(() => result.current.acciones.confirm(9))

    await waitFor(() => expect(result.current.acciones.isBusy).toBe(true))
    expect(result.current.acciones.errorFor(9)).toBeNull()

    act(() => confirmacion.resolver({ matchId: 9, status: 'confirmed', confirmedAt: null }))
    await waitFor(() => expect(result.current.acciones.isBusy).toBe(false))
    expect(result.current.acciones.errorFor(9)).toBeNull()
  })
})
