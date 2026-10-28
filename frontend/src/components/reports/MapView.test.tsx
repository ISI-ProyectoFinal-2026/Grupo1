import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import MapView from '@/components/reports/MapView'
import { PIN_COLORS } from '@/components/reports/reportPinIcon'
import { PILOT_ZONE_CENTER } from '@/lib/map'
import type { ReportDTO } from '@/types/report.types'

vi.mock('react-leaflet', () => import('@/test/react-leaflet-mock'))

function reporte(overrides: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: 5,
    userId: 7,
    petId: null,
    reportType: 'lost',
    status: 'published',
    title: 'Perra perdida en el centro',
    description: null,
    imageUrl: null,
    customFlyerUrl: null,
    locationAddress: 'San Rafael',
    location: { lat: -34.62, lng: -68.33 },
    tag: { label: 'PERDIDO', color: '#EF4444' },
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '2026-09-19T10:00:00.000Z',
    publishedAt: '2026-09-19T10:05:00.000Z',
    ...overrides,
  }
}

function renderMap(props: Parameters<typeof MapView>[0]) {
  return render(
    <MemoryRouter>
      <MapView {...props} />
    </MemoryRouter>
  )
}

describe('MapView', () => {
  it('arranca centrado en la zona del piloto', () => {
    renderMap({ reports: [reporte()] })

    expect(screen.getByTestId('map')).toHaveAttribute('data-center', PILOT_ZONE_CENTER.join(','))
  })

  it('respeta un centro explicito', () => {
    renderMap({ reports: [reporte()], center: [-31.42, -64.18] })

    expect(screen.getByTestId('map')).toHaveAttribute('data-center', '-31.42,-64.18')
  })

  it('dibuja un pin por reporte con ubicacion', () => {
    renderMap({ reports: [reporte(), reporte({ id: 6, location: null })] })

    expect(screen.getAllByTestId('marker')).toHaveLength(1)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-position', '-34.62,-68.33')
  })

  it('pinta de rojo el pin de un reporte perdido', () => {
    renderMap({ reports: [reporte({ id: 1, reportType: 'lost' })] })

    const html = screen.getByTestId('marker').getAttribute('data-icon-html')
    expect(html).toContain(PIN_COLORS.lost)
    expect(html).not.toContain(PIN_COLORS.found)
  })

  it('pinta de azul el pin de un reporte encontrado', () => {
    renderMap({ reports: [reporte({ id: 2, reportType: 'found' })] })

    const html = screen.getByTestId('marker').getAttribute('data-icon-html')
    expect(html).toContain(PIN_COLORS.found)
    expect(html).not.toContain(PIN_COLORS.lost)
  })

  it('usa un color distinto para cada tipo en el mismo mapa', () => {
    renderMap({
      reports: [reporte({ id: 1, reportType: 'lost' }), reporte({ id: 2, reportType: 'found' })],
    })

    const [lost, found] = screen.getAllByTestId('marker')
    expect(lost.getAttribute('data-icon-html')).not.toBe(found.getAttribute('data-icon-html'))
  })
})
