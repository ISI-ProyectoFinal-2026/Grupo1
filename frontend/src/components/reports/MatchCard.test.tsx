import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import MatchCard from '@/components/reports/MatchCard'
import type { MatchDTO } from '@/types/report.types'

function coincidencia(overrides: Partial<MatchDTO> = {}): MatchDTO {
  return {
    matchId: 9,
    reportId: 21,
    title: 'Perra encontrada en Caballito',
    imageUrl: null,
    reportType: 'found',
    similarityScore: 0.91,
    status: 'pending',
    createdAt: '2026-09-20T10:00:00.000Z',
    ...overrides,
  }
}

function renderCard(props: Partial<ComponentProps<typeof MatchCard>> = {}) {
  return render(
    <MemoryRouter>
      <MatchCard match={coincidencia()} {...props} />
    </MemoryRouter>
  )
}

const confirmar = () => screen.queryByRole('button', { name: 'Confirmar coincidencia' })
const descartar = () => screen.queryByRole('button', { name: 'Descartar' })

describe('MatchCard', () => {
  it('enlaza al otro reporte de la coincidencia', () => {
    renderCard()

    expect(screen.getByRole('link')).toHaveAttribute('href', '/reports/21')
  })

  it('ofrece confirmar y descartar al dueño cuando la coincidencia está pendiente', () => {
    renderCard({ canManage: true })

    expect(confirmar()).toBeInTheDocument()
    expect(descartar()).toBeInTheDocument()
  })

  it('no ofrece acciones a quien no es dueño del reporte', () => {
    renderCard({ canManage: false })

    expect(confirmar()).not.toBeInTheDocument()
    expect(descartar()).not.toBeInTheDocument()
  })

  it('avisa con el id de la coincidencia al confirmar y al descartar', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onReject = vi.fn()
    renderCard({ canManage: true, onConfirm, onReject })

    await user.click(confirmar()!)
    await user.click(descartar()!)

    expect(onConfirm).toHaveBeenCalledWith(9)
    expect(onReject).toHaveBeenCalledWith(9)
  })

  it('muestra el badge y no ofrece acciones si la coincidencia ya está confirmada', () => {
    renderCard({ canManage: true, match: coincidencia({ status: 'confirmed' }) })

    expect(screen.getByText('Coincidencia confirmada')).toBeInTheDocument()
    expect(confirmar()).not.toBeInTheDocument()
    expect(descartar()).not.toBeInTheDocument()
  })

  it('no muestra el badge de confirmada mientras está pendiente', () => {
    renderCard({ canManage: true })

    expect(screen.queryByText('Coincidencia confirmada')).not.toBeInTheDocument()
  })

  it('deshabilita ambas acciones mientras hay una en curso', () => {
    renderCard({ canManage: true, isBusy: true })

    expect(confirmar()).toBeDisabled()
    expect(descartar()).toBeDisabled()
  })

  it('muestra el mensaje de error de la API', () => {
    renderCard({ canManage: true, error: 'La coincidencia ya fue rechazada' })

    expect(screen.getByRole('alert')).toHaveTextContent('La coincidencia ya fue rechazada')
  })
})
