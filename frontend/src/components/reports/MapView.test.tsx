import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import MapView from '@/components/reports/MapView'
import { PIN_COLORS } from '@/components/reports/reportPinIcon'
import type { ReportDTO } from '@/types/report.types'

// jsdom no renderiza tiles ni mide el mapa: se dobla react-leaflet y el
// Marker expone el icono recibido para poder inspeccionarlo.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Marker: ({
    icon,
    children,
  }: {
    icon: { options: { html?: string } }
    children: ReactNode
  }) => (
    <div data-testid='marker' data-icon-html={icon.options.html}>
      {children}
    </div>
  ),
}))

function buildReport(overrides: Partial<ReportDTO>): ReportDTO {
  return {
    id: 1,
    userId: 1,
    petId: null,
    reportType: 'lost',
    status: 'published',
    title: 'Reporte',
    description: null,
    imageUrl: null,
    customFlyerUrl: null,
    locationAddress: null,
    location: { lat: -34.6, lng: -58.38 },
    tag: { label: 'Perdido', color: 'red' },
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    publishedAt: null,
    ...overrides,
  }
}

function renderMap(reports: ReportDTO[]) {
  return render(
    <MemoryRouter>
      <MapView reports={reports} />
    </MemoryRouter>,
  )
}

describe('MapView', () => {
  it('pinta de rojo el pin de un reporte perdido', () => {
    renderMap([buildReport({ id: 1, reportType: 'lost' })])

    const html = screen.getByTestId('marker').getAttribute('data-icon-html')
    expect(html).toContain(PIN_COLORS.lost)
    expect(html).not.toContain(PIN_COLORS.found)
  })

  it('pinta de azul el pin de un reporte encontrado', () => {
    renderMap([buildReport({ id: 2, reportType: 'found' })])

    const html = screen.getByTestId('marker').getAttribute('data-icon-html')
    expect(html).toContain(PIN_COLORS.found)
    expect(html).not.toContain(PIN_COLORS.lost)
  })

  it('usa un color distinto para cada tipo en el mismo mapa', () => {
    renderMap([
      buildReport({ id: 1, reportType: 'lost' }),
      buildReport({ id: 2, reportType: 'found' }),
    ])

    const [lost, found] = screen.getAllByTestId('marker')
    expect(lost.getAttribute('data-icon-html')).not.toBe(found.getAttribute('data-icon-html'))
  })
})
