import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PendingBanner from '@/components/reports/PendingBanner'

describe('PendingBanner', () => {
  it('avisa que el reporte esta buscando coincidencias', () => {
    render(<PendingBanner />)

    expect(screen.getByText(/buscando coincidencias/i)).toBeInTheDocument()
  })

  it('acepta clases extra para acomodarse al contenedor', () => {
    const { container } = render(<PendingBanner className='mt-8' />)

    expect(container.firstChild).toHaveClass('mt-8')
  })
})
