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
      <ReportFlagList flags={[flag()]} onResolve={vi.fn()} isResolving={false} {...props} />
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

  it.each([
    ['Ocultar reporte', 'accept'],
    ['Descartar', 'dismiss'],
  ] as const)('"%s" avisa con el id del flag y la accion %s', async (boton, accion) => {
    const user = userEvent.setup()
    const onResolve = vi.fn()
    renderList({ flags: [flag({ id: 42 })], onResolve })

    await user.click(screen.getByRole('button', { name: boton }))

    expect(onResolve).toHaveBeenCalledWith(42, accion)
  })

  // aceptar cierra las demas denuncias del reporte: se bloquean todas mientras tanto
  it('deshabilita todas las acciones mientras se resuelve una denuncia', () => {
    renderList({ flags: [flag({ id: 1 }), flag({ id: 2, reportId: 20 })], isResolving: true })

    for (const boton of screen.getAllByRole('button')) {
      expect(boton).toBeDisabled()
    }
  })

  it.each([
    ['reviewed', 'Aceptada'],
    ['dismissed', 'Descartada'],
  ] as const)('no ofrece acciones sobre un flag %s', (status, etiqueta) => {
    renderList({ flags: [flag({ status })] })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(etiqueta)).toBeInTheDocument()
  })
})
