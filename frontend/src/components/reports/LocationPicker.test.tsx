import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LocationPicker from '@/components/reports/LocationPicker'

describe('LocationPicker', () => {
  it('sin ubicacion inicial no muestra ninguna seleccionada', () => {
    render(<LocationPicker onLocationSelect={vi.fn()} />)

    expect(screen.queryByText('Ubicación seleccionada')).not.toBeInTheDocument()
  })

  it('muestra la ubicacion guardada cuando se edita un reporte', () => {
    render(
      <LocationPicker
        onLocationSelect={vi.fn()}
        initialLocation={{ lat: -31.42, lng: -64.18 }}
        initialAddress='Nueva Córdoba'
      />
    )

    expect(screen.getByText('Ubicación seleccionada')).toBeInTheDocument()
    expect(screen.getByText('Nueva Córdoba')).toBeInTheDocument()
    expect(screen.getByText('-31.4200, -64.1800')).toBeInTheDocument()
  })
})
