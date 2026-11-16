import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ReportFlagGroupList from '@/components/moderation/ReportFlagGroupList'
import type { ReportFlagGroupDTO } from '@/types/moderation.types'

function group(overrides: Partial<ReportFlagGroupDTO> = {}): ReportFlagGroupDTO {
  return {
    report: {
      id: 10,
      title: 'Perrito en Plaza de Mayo',
      status: 'published',
      reportType: 'lost',
      imageUrl: null,
      description: 'Collar rojo',
    },
    flagCount: 2,
    reasonCounts: { spam: 1, offensive: 1 },
    otherDetails: [],
    lastFlaggedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

function hiddenGroup(overrides: Partial<ReportFlagGroupDTO> = {}) {
  return group({
    report: { ...group().report, id: 20, title: 'Gato perdido', status: 'hidden' },
    flagCount: 5,
    reasonCounts: { false_info: 5 },
    ...overrides,
  })
}

function renderList(props: Partial<React.ComponentProps<typeof ReportFlagGroupList>> = {}) {
  return render(
    <MemoryRouter>
      <ReportFlagGroupList groups={[group()]} onAction={vi.fn()} isActing={false} {...props} />
    </MemoryRouter>
  )
}

describe('ReportFlagGroupList', () => {
  it('avisa cuando no hay nada para moderar', () => {
    renderList({ groups: [] })

    expect(screen.getByText('No hay reportes pendientes de moderación')).toBeInTheDocument()
  })

  it('muestra el reporte con su estado, la cantidad de denuncias y los motivos con su conteo', () => {
    renderList()

    expect(screen.getByRole('link', { name: 'Perrito en Plaza de Mayo' })).toHaveAttribute('href', '/reports/10')
    expect(screen.getByText('Publicado')).toBeInTheDocument()
    expect(screen.getByText('2 denuncias')).toBeInTheDocument()
    expect(screen.getByText('Spam o publicidad: 1')).toBeInTheDocument()
    expect(screen.getByText('Contenido ofensivo: 1')).toBeInTheDocument()
    expect(screen.getByText('Collar rojo')).toBeInTheDocument()
  })

  it('usa el singular con una sola denuncia', () => {
    renderList({ groups: [group({ flagCount: 1, reasonCounts: { spam: 1 } })] })

    expect(screen.getByText('1 denuncia')).toBeInTheDocument()
  })

  it('muestra los detalles escritos para el motivo Otro', () => {
    renderList({
      groups: [group({ reasonCounts: { other: 2 }, otherDetails: ['Es una estafa', 'Foto robada'] })],
    })

    expect(screen.getByText('Es una estafa')).toBeInTheDocument()
    expect(screen.getByText('Foto robada')).toBeInTheDocument()
  })

  it('un reporte publicado con denuncias ofrece Ocultar y Descartar, sin Restaurar ni Confirmar', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    renderList({ onAction })

    expect(screen.queryByRole('button', { name: 'Restaurar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar ocultamiento' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ocultar' }))
    await user.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(onAction).toHaveBeenNthCalledWith(1, 10, 'hide')
    expect(onAction).toHaveBeenNthCalledWith(2, 10, 'dismiss')
  })

  it('un reporte oculto ofrece Restaurar y Confirmar ocultamiento, sin Ocultar ni Descartar', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    renderList({ groups: [hiddenGroup()], onAction })

    expect(screen.getByText('Oculto por denuncias')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ocultar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restaurar' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar ocultamiento' }))

    expect(onAction).toHaveBeenNthCalledWith(1, 20, 'restore')
    expect(onAction).toHaveBeenNthCalledWith(2, 20, 'confirm')
  })

  it('advierte que confirmar el ocultamiento es definitivo', () => {
    renderList({ groups: [hiddenGroup()] })

    expect(screen.getByText(/Confirmar es definitivo/)).toBeInTheDocument()
  })

  it('separa los ocultos en su propia seccion antes de los publicados con denuncias', () => {
    renderList({ groups: [hiddenGroup(), group()] })

    const hiddenSection = screen.getByRole('region', { name: 'Ocultos pendientes de revisión' })
    const publishedSection = screen.getByRole('region', { name: 'Publicados con denuncias' })
    expect(within(hiddenSection).getByText('Gato perdido')).toBeInTheDocument()
    expect(within(publishedSection).getByText('Perrito en Plaza de Mayo')).toBeInTheDocument()
    expect(
      hiddenSection.compareDocumentPosition(publishedSection) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('deshabilita todas las acciones mientras se procesa una', () => {
    renderList({ groups: [hiddenGroup(), group()], isActing: true })

    for (const boton of screen.getAllByRole('button')) {
      expect(boton).toBeDisabled()
    }
  })
})
