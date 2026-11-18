import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import { useAuthStore } from '@/stores/auth.store'
import * as reportsService from '@/services/reports.service'
import * as adsService from '@/services/ads.service'
import ReportDetailPage from '@/pages/reports/ReportDetailPage'
import type { ReportDTO, ReportStatus } from '@/types/report.types'

vi.mock('@/services/reports.service')
vi.mock('@/services/chats.service')
vi.mock('@/services/moderation.service')
vi.mock('react-leaflet', () => import('@/test/react-leaflet-mock'))

vi.mock('@/services/ads.service', () => ({
  getAdFor: vi.fn().mockResolvedValue(null),
  getNearbyBusinesses: vi.fn().mockResolvedValue([]),
  recordAdEvent: vi.fn().mockResolvedValue(undefined),
  flagAd: vi.fn().mockResolvedValue(undefined),
}))

function reporte(overrides: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: 5,
    userId: 7,
    petId: null,
    reportType: 'lost',
    status: 'published',
    title: 'Perra perdida en Caballito',
    description: 'Collar rojo',
    imageUrl: null,
    extraImageUrls: [],
    customFlyerUrl: null,
    showPhoneOnFlyer: false,
    eventDate: null,
    locationAddress: 'Caballito, CABA',
    location: null,
    tag: { label: 'PERDIDO', color: '#EF4444' },
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '2026-09-19T10:00:00.000Z',
    publishedAt: '2026-09-19T10:05:00.000Z',
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

// visitante sin sesion: el reporte es material de difusion publico (#187)
describe('ReportDetailPage sin sesion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ token: null, user: null })
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte())
    vi.mocked(reportsService.getMatches).mockResolvedValue([])
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it.each<ReportStatus>(['published', 'resolved'])('muestra el reporte %s', async (status) => {
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte({ status }))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Perra perdida en Caballito' })).toBeInTheDocument()
    expect(screen.getByText('Collar rojo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generar flyer' })).toBeInTheDocument()
  })

  it('no pide las coincidencias: el endpoint exige sesion', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Perra perdida en Caballito' })

    expect(reportsService.getMatches).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Coincidencias sugeridas' })).not.toBeInTheDocument()
  })

  it('mantiene los comercios cercanos y la publicidad, que son publicos', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Perra perdida en Caballito' })

    expect(adsService.getNearbyBusinesses).toHaveBeenCalledWith(5)
    expect(adsService.getAdFor).toHaveBeenCalledWith('report_detail', 5)
  })

  it('no ofrece acciones de cuenta ni de dueño', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Perra perdida en Caballito' })

    expect(screen.queryByRole('complementary', { name: 'Acciones del reporte' })).not.toBeInTheDocument()
    for (const name of ['Contactar al autor', 'Cerrar reporte', 'Eliminar reporte', 'Denunciar', 'Reportar cuenta']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('link', { name: 'Editar reporte' })).not.toBeInTheDocument()
  })
})
