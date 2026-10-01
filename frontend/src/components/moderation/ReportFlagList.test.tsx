import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ReportFlagList from '@/components/moderation/ReportFlagList'
import type { ReportFlagDTO } from '@/types/moderation.types'

function flag(overrides: Partial<ReportFlagDTO> = {}): ReportFlagDTO {
  return {
    id: 1,
    reportId: 10,
    userId: 7,
    reason: 'Publicacion falsa',
    status: 'pending',
    createdAt: '2026-09-01T10:00:00.000Z',
    report: { id: 10, title: 'Perrito en Plaza de Mayo', status: 'published' },
    ...overrides,
  }
}

function renderList(props: Partial<React.ComponentProps<typeof ReportFlagList>> = {}) {
  return render(
    <MemoryRouter>
      <ReportFlagList flags={[flag()]} onResolve={vi.fn()} resolvingId={null} {...props} />
    </MemoryRouter>
  )
}

describe('ReportFlagList', () => {
  it('avisa cuando no hay nada para moderar', () => {
    renderList({ flags: [] })

    expect(screen.getByText('No hay reportes pendientes de moderación')).toBeInTheDocument()
  })

  it('muestra el titulo del reporte, el motivo y el estado', () => {
    renderList()

    expect(screen.getByText('Perrito en Plaza de Mayo')).toBeInTheDocument()
    expect(screen.getByText('Publicacion falsa')).toBeInTheDocument()
    expect(screen.getByText('Publicado')).toBeInTheDocument()
  })

  it('enlaza al detalle del reporte denunciado', () => {
    renderList()

    expect(screen.getByRole('link', { name: 'Perrito en Plaza de Mayo' })).toHaveAttribute(
      'href',
      '/reports/10'
    )
  })

  it('avisa con el id del flag cuando se resuelve', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn()
    renderList({ flags: [flag({ id: 42 })], onResolve })

    await user.click(screen.getByRole('button', { name: 'Resolver y ocultar' }))

    expect(onResolve).toHaveBeenCalledWith(42)
  })

  it('deshabilita solo el flag que se esta resolviendo', () => {
    renderList({ flags: [flag({ id: 1 }), flag({ id: 2, reportId: 20 })], resolvingId: 1 })

    const botones = screen.getAllByRole('button', { name: 'Resolver y ocultar' })
    expect(botones[0]).toBeDisabled()
    expect(botones[1]).toBeEnabled()
  })

  it('no ofrece resolver un flag ya revisado', () => {
    renderList({ flags: [flag({ status: 'reviewed' })] })

    expect(screen.queryByRole('button', { name: 'Resolver y ocultar' })).not.toBeInTheDocument()
    expect(screen.getByText('Revisado')).toBeInTheDocument()
  })
})
