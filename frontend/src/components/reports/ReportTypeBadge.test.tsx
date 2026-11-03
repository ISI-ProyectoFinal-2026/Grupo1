import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ReportTypeBadge from '@/components/reports/ReportTypeBadge'

describe('ReportTypeBadge', () => {
  it('muestra "Mascota Perdida" en rojo', () => {
    render(<ReportTypeBadge reportType='lost' />)

    expect(screen.getByText('Mascota Perdida')).toHaveClass('bg-lost', 'text-white')
  })

  it('muestra "Mascota Encontrada" en azul', () => {
    render(<ReportTypeBadge reportType='found' />)

    expect(screen.getByText('Mascota Encontrada')).toHaveClass('bg-found', 'text-white')
  })
})
