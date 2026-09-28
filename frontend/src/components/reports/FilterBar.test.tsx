import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FilterBar from '@/components/reports/FilterBar'

function renderFilterBar(overrides: Partial<Parameters<typeof FilterBar>[0]> = {}) {
  const props = {
    type: '' as const,
    zone: '',
    dateFrom: '',
    dateTo: '',
    onTypeChange: vi.fn(),
    onZoneChange: vi.fn(),
    onDateFromChange: vi.fn(),
    onDateToChange: vi.fn(),
    ...overrides,
  }
  render(<FilterBar {...props} />)
  return props
}

describe('FilterBar', () => {
  it('ofrece los tres estados del filtro de tipo', () => {
    renderFilterBar()

    const select = screen.getByLabelText('Tipo')
    expect(select).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Todos' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Perdidas' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Encontradas' })).toBeInTheDocument()
  })

  it('avisa el tipo elegido', async () => {
    const user = userEvent.setup()
    const props = renderFilterBar()

    await user.selectOptions(screen.getByLabelText('Tipo'), 'found')

    expect(props.onTypeChange).toHaveBeenCalledWith('found')
  })

  // Volver a "Todos" tiene que limpiar el filtro, no mandar la cadena "Todos".
  it('limpia el tipo al volver a Todos', async () => {
    const user = userEvent.setup()
    const props = renderFilterBar({ type: 'lost' })

    await user.selectOptions(screen.getByLabelText('Tipo'), '')

    expect(props.onTypeChange).toHaveBeenCalledWith('')
  })

  it('avisa cada tecla escrita en la zona', async () => {
    const user = userEvent.setup()
    const props = renderFilterBar()

    await user.type(screen.getByLabelText('Zona'), 'G')

    expect(props.onZoneChange).toHaveBeenCalledWith('G')
  })

  it('avisa los cambios de rango de fechas', async () => {
    const user = userEvent.setup()
    const props = renderFilterBar()

    await user.type(screen.getByLabelText('Desde'), '2026-09-01')
    await user.type(screen.getByLabelText('Hasta'), '2026-09-30')

    expect(props.onDateFromChange).toHaveBeenCalledWith('2026-09-01')
    expect(props.onDateToChange).toHaveBeenCalledWith('2026-09-30')
  })

  it('refleja los valores ya aplicados', () => {
    renderFilterBar({ type: 'lost', zone: 'Güemes', dateFrom: '2026-09-01' })

    expect(screen.getByLabelText('Tipo')).toHaveValue('lost')
    expect(screen.getByLabelText('Zona')).toHaveValue('Güemes')
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-09-01')
  })
})
