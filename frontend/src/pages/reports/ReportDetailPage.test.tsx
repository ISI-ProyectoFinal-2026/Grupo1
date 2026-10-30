import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import { useAuthStore } from '@/stores/auth.store'
import * as reportsService from '@/services/reports.service'
import ReportDetailPage from '@/pages/reports/ReportDetailPage'
import { PIN_COLORS } from '@/components/reports/reportPinIcon'
import type { MatchDTO, ReportDTO } from '@/types/report.types'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/reports.service')
vi.mock('@/services/chats.service')
vi.mock('react-leaflet', () => import('@/test/react-leaflet-mock'))

const DUENO_ID = 7

function usuario(id: number): AuthUser {
  return {
    id,
    email: `usuario${id}@patitas.test`,
    fullName: null,
    phone: null,
    role: 'usuario_regular',
    emailVerifiedAt: '2026-09-01T10:00:00.000Z',
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

describe('ReportDetailPage estado', () => {
  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('muestra el estado en castellano, no el valor crudo de la API', async () => {
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte({ status: 'published' }))
    vi.mocked(reportsService.getMatches).mockResolvedValue([])
    useAuthStore.setState({ token: 'token', user: usuario(DUENO_ID + 1) })
    renderPage()

    expect(await screen.findByText('Publicado')).toBeInTheDocument()
    expect(screen.queryByText('published')).not.toBeInTheDocument()
  })
})

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

describe('ReportDetailPage mapa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(reportsService.getMatches).mockResolvedValue([])
  })

  it('muestra un mapa con el pin en la ubicación del reporte', async () => {
    vi.mocked(reportsService.getReport).mockResolvedValue(
      reporte({ location: { lat: -34.6177, lng: -68.3301 }, locationAddress: 'San Rafael' })
    )
    renderPage()

    const mapa = await screen.findByRole('region', { name: 'Mapa de la ubicación' })
    expect(within(mapa).getByTestId('map')).toHaveAttribute('data-center', '-34.6177,-68.3301')
    const pin = within(mapa).getByTestId('marker')
    expect(pin).toHaveAttribute('data-position', '-34.6177,-68.3301')
    expect(pin).toHaveAttribute('data-draggable', 'false')
    expect(pin).toHaveAttribute('title', 'San Rafael')
  })

  it.each([
    ['lost', PIN_COLORS.lost],
    ['found', PIN_COLORS.found],
  ] as const)('el pin del mapa usa el color del tipo de reporte (%s)', async (reportType, color) => {
    vi.mocked(reportsService.getReport).mockResolvedValue(
      reporte({ reportType, location: { lat: -34.6177, lng: -68.3301 } })
    )
    renderPage()

    const mapa = await screen.findByRole('region', { name: 'Mapa de la ubicación' })
    expect(within(mapa).getByTestId('marker').getAttribute('data-icon-html')).toContain(color)
  })

  it('no muestra mapa si el reporte no tiene coordenadas', async () => {
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte({ location: null }))
    renderPage()

    expect(await screen.findByText('Perra perdida en Caballito')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Mapa de la ubicación' })).not.toBeInTheDocument()
  })
})

describe('ReportDetailPage flyer propio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte())
    vi.mocked(reportsService.getMatches).mockResolvedValue([])
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('el dueño ve la opción de subir su propio flyer', async () => {
    useAuthStore.setState({ token: 'token', user: usuario(DUENO_ID) })
    renderPage()

    expect(await screen.findByText('o subí tu propio flyer')).toBeInTheDocument()
  })

  it.each([
    ['otro usuario logueado', usuario(DUENO_ID + 1)],
    ['un visitante sin sesión', null],
  ])('%s no ve la opción de subir un flyer propio', async (_caso, user) => {
    useAuthStore.setState({ token: user ? 'token' : null, user })
    renderPage()

    expect(await screen.findByText('Flyer para compartir')).toBeInTheDocument()
    expect(screen.queryByText('o subí tu propio flyer')).not.toBeInTheDocument()
  })
})
