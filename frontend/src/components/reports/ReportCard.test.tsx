import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ReportCard from '@/components/reports/ReportCard'
import type { ReportDTO } from '@/types/report.types'

function reporte(overrides: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: 5,
    userId: 7,
    petId: null,
    reportType: 'lost',
    status: 'published',
    title: 'Perro perdido en Nueva Córdoba',
    description: 'Collar rojo, responde a Pepe',
    imageUrl: 'https://cdn/pepe.jpg',
    customFlyerUrl: null,
    locationAddress: 'Nueva Córdoba',
    location: { lat: -31.42, lng: -64.18 },
    tag: { label: 'Perdido', color: '#ef4444' },
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    publishedAt: '2026-09-20T10:00:00.000Z',
    ...overrides,
  }
}

function renderCard(report: ReportDTO) {
  return render(
    <MemoryRouter>
      <ReportCard report={report} />
    </MemoryRouter>
  )
}

describe('ReportCard', () => {
  it('linkea al detalle del reporte', () => {
    renderCard(reporte())

    expect(screen.getByRole('link')).toHaveAttribute('href', '/reports/5')
  })

  it('muestra titulo, descripcion, zona y etiqueta', () => {
    renderCard(reporte())

    expect(screen.getByText('Perro perdido en Nueva Córdoba')).toBeInTheDocument()
    expect(screen.getByText('Collar rojo, responde a Pepe')).toBeInTheDocument()
    expect(screen.getByText(/📍/)).toHaveTextContent('Nueva Córdoba')
    expect(screen.getByText('Perdido')).toBeInTheDocument()
  })

  it('usa la foto del reporte con el titulo como alt', () => {
    renderCard(reporte())

    expect(screen.getByAltText('Perro perdido en Nueva Córdoba')).toHaveAttribute(
      'src',
      'https://cdn/pepe.jpg'
    )
  })

  it('cae al placeholder cuando el reporte no tiene foto', () => {
    renderCard(reporte({ imageUrl: null }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('🐾')).toBeInTheDocument()
  })

  it('usa textos por defecto cuando faltan descripcion y zona', () => {
    renderCard(reporte({ description: null, locationAddress: null }))

    expect(screen.getByText('Sin descripción')).toBeInTheDocument()
    expect(screen.getByText(/📍/)).toHaveTextContent('Ubicación desconocida')
  })
})
