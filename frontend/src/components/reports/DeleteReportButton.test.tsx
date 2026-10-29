import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DeleteReportButton from '@/components/reports/DeleteReportButton'

function renderBoton(props: Partial<ComponentProps<typeof DeleteReportButton>> = {}) {
  const onConfirm = vi.fn()
  render(<DeleteReportButton onConfirm={onConfirm} {...props} />)
  return { onConfirm }
}

describe('DeleteReportButton', () => {
  it('pide confirmación antes de eliminar', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderBoton()

    await user.click(screen.getByRole('button', { name: 'Eliminar reporte' }))

    expect(screen.getByText(/¿Seguro que querés eliminar este reporte\?/)).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('elimina al confirmar', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderBoton()

    await user.click(screen.getByRole('button', { name: 'Eliminar reporte' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancelar vuelve atrás sin eliminar', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderBoton()

    await user.click(screen.getByRole('button', { name: 'Eliminar reporte' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('button', { name: 'Confirmar eliminación' })).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('muestra el error recibido', () => {
    renderBoton({ error: 'No se pudo eliminar el reporte, intentá de nuevo.' })

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo eliminar el reporte')
  })
})
