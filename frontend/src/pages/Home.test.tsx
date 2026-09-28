import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Home from '@/pages/Home'

describe('Home', () => {
  it('explica los tres pasos del producto', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: /PATITAS/ })).toBeInTheDocument()
    expect(screen.getByText('Sube una foto')).toBeInTheDocument()
    expect(screen.getByText('IA detecta similitud')).toBeInTheDocument()
    expect(screen.getByText('Conectá con otros')).toBeInTheDocument()
  })

  it('ofrece los dos accesos principales al feed y al alta', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: 'Ver Reportes' })).toHaveAttribute('href', '/reports')
    expect(screen.getByRole('link', { name: 'Crear Reporte' })).toHaveAttribute(
      'href',
      '/reports/new'
    )
  })
})
