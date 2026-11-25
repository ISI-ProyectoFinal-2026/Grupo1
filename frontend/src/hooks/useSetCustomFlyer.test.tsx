import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as reportsService from '@/services/reports.service'
import { useSetCustomFlyer } from '@/hooks/useSetCustomFlyer'
import type { ReportDTO } from '@/types/report.types'

vi.mock('@/services/reports.service')

const GENERIC_MESSAGE = 'No se pudo guardar el flyer, intentá de nuevo.'

function errorConStatus(message: string, status: number) {
  return Object.assign(new Error(message), { status })
}

function renderCustomFlyer(onSaved = vi.fn()) {
  const hook = renderHook(() => useSetCustomFlyer(5, onSaved))
  return { ...hook, onSaved }
}

describe('useSetCustomFlyer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guarda el flyer propio y entrega su url', async () => {
    vi.mocked(reportsService.uploadCustomFlyer).mockResolvedValue({} as ReportDTO)
    const { result, onSaved } = renderCustomFlyer()

    await act(() => result.current.save('https://cdn/propio.png'))

    expect(reportsService.uploadCustomFlyer).toHaveBeenCalledWith(5, 'https://cdn/propio.png')
    expect(onSaved).toHaveBeenCalledWith('https://cdn/propio.png')
    expect(result.current.error).toBeNull()
  })

  it.each([422, 409])('con un %i muestra el mensaje del backend', async (status) => {
    vi.mocked(reportsService.uploadCustomFlyer).mockRejectedValue(
      errorConStatus('Mensaje del backend', status)
    )
    const { result, onSaved } = renderCustomFlyer()

    await act(() => result.current.save('https://cdn/propio.png'))

    expect(result.current.error).toBe('Mensaje del backend')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('ante otro error muestra un mensaje genérico', async () => {
    vi.mocked(reportsService.uploadCustomFlyer).mockRejectedValue(
      errorConStatus('Internal Server Error', 500)
    )
    const { result } = renderCustomFlyer()

    await act(() => result.current.save('https://cdn/propio.png'))

    expect(result.current.error).toBe(GENERIC_MESSAGE)
  })

  it('al reintentar limpia el error anterior', async () => {
    vi.mocked(reportsService.uploadCustomFlyer)
      .mockRejectedValueOnce(errorConStatus('Internal Server Error', 500))
      .mockResolvedValueOnce({} as ReportDTO)
    const { result } = renderCustomFlyer()

    await act(() => result.current.save('https://cdn/propio.png'))
    await act(() => result.current.save('https://cdn/propio.png'))

    await waitFor(() => expect(result.current.error).toBeNull())
  })

  it('muestra un error informado desde afuera, como el del uploader', () => {
    const { result } = renderCustomFlyer()

    act(() => result.current.showError('La imagen es demasiado grande'))

    expect(result.current.error).toBe('La imagen es demasiado grande')
  })
})
