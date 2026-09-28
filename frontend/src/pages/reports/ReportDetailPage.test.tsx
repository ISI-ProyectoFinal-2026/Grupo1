import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import { useAuthStore } from '@/stores/auth.store'
import * as reportsService from '@/services/reports.service'
import ReportDetailPage from '@/pages/reports/ReportDetailPage'
import type { MatchDTO, ReportDTO } from '@/types/report.types'

vi.mock('@/services/reports.service')
vi.mock('@/services/chats.service')

const DUENO_ID = 7

function usuario(id: number) {
  return {
    id,
    email: `usuario${id}@patitas.test`,
    fullName: null,
    phone: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function reporte(overrides: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: 5,
    userId: DUENO_ID,
    petId: null,
    reportType: 'lost',
    status: 'published',
    title: 'Perra perdida en Caballito',
    description: null,
    imageUrl: null,
    customFlyerUrl: null,
    locationAddress: 'Caballito, CABA',
    location: null,
    tag: { label: 'PERDIDO', color: '#EF4444' },
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '2026-09-19T10:00:00.000Z',
    publishedAt: '2026-09-19T10:05:00.000Z',
    ...overrides,
  }
}

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

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={['/reports/5']}>
        <Routes>
          <Route path='/reports/:id' element={<ReportDetailPage />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

describe('ReportDetailPage coincidencias', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte())
    vi.mocked(reportsService.getMatches).mockResolvedValue([coincidencia()])
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('el dueño confirma una coincidencia pendiente y ve la lista actualizada', async () => {
    useAuthStore.setState({ token: 'token', user: usuario(DUENO_ID) })
    vi.mocked(reportsService.confirmMatch).mockResolvedValue({
      matchId: 9,
      status: 'confirmed',
      confirmedAt: '2026-09-27T12:00:00.000Z',
    })
    const user = userEvent.setup()
    renderPage()

    const confirmar = await screen.findByRole('button', { name: 'Confirmar coincidencia' })
    vi.mocked(reportsService.getMatches).mockResolvedValue([coincidencia({ status: 'confirmed' })])
    await user.click(confirmar)

    expect(await screen.findByText('Coincidencia confirmada')).toBeInTheDocument()
    expect(reportsService.confirmMatch).toHaveBeenCalledWith(5, 9)
    expect(screen.queryByRole('button', { name: 'Confirmar coincidencia' })).not.toBeInTheDocument()
  })

  it('el dueño descarta una coincidencia y deja de verla', async () => {
    useAuthStore.setState({ token: 'token', user: usuario(DUENO_ID) })
    vi.mocked(reportsService.rejectMatch).mockResolvedValue({
      matchId: 9,
      status: 'rejected',
      confirmedAt: null,
    })
    const user = userEvent.setup()
    renderPage()

    const descartar = await screen.findByRole('button', { name: 'Descartar' })
    vi.mocked(reportsService.getMatches).mockResolvedValue([])
    await user.click(descartar)

    expect(await screen.findByText('No se encontraron coincidencias todavía')).toBeInTheDocument()
    expect(reportsService.rejectMatch).toHaveBeenCalledWith(5, 9)
  })

  it('muestra en la tarjeta el error de la API si la decisión falla', async () => {
    useAuthStore.setState({ token: 'token', user: usuario(DUENO_ID) })
    vi.mocked(reportsService.confirmMatch).mockRejectedValue(
      new Error('La coincidencia ya fue rechazada')
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Confirmar coincidencia' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La coincidencia ya fue rechazada')
  })

  it('mientras decide una coincidencia, deshabilita las acciones de todas las demás', async () => {
    useAuthStore.setState({ token: 'token', user: usuario(DUENO_ID) })
    vi.mocked(reportsService.getMatches).mockResolvedValue([
      coincidencia({ matchId: 9 }),
      coincidencia({ matchId: 10, reportId: 22, title: 'Perra encontrada en Almagro' }),
    ])
    vi.mocked(reportsService.confirmMatch).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage()

    const confirmar = await screen.findAllByRole('button', { name: 'Confirmar coincidencia' })
    expect(confirmar).toHaveLength(2)
    await user.click(confirmar[0])

    await waitFor(() => {
      for (const boton of screen.getAllByRole('button', { name: /Confirmar coincidencia|Descartar/ })) {
        expect(boton).toBeDisabled()
      }
    })
  })

  it('quien no es dueño ve las coincidencias pero no puede decidir', async () => {
    useAuthStore.setState({ token: 'token', user: usuario(DUENO_ID + 1) })
    renderPage()

    await waitFor(() =>
      expect(screen.getByText('Perra encontrada en Caballito')).toBeInTheDocument()
    )
    expect(screen.queryByRole('button', { name: 'Confirmar coincidencia' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument()
  })
})
