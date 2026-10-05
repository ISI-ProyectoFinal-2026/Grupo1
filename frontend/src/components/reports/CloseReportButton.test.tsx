import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CloseReportButton from '@/components/reports/CloseReportButton'

function renderBoton(props: Partial<ComponentProps<typeof CloseReportButton>> = {}) {
  const onConfirm = vi.fn()
  render(<CloseReportButton onConfirm={onConfirm} {...props} />)
  return { onConfirm }
}

describe('CloseReportButton', () => {
  it('pide confirmación antes de cerrar', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderBoton()

    await user.click(screen.getByRole('button', { name: 'Cerrar reporte' }))

    expect(screen.getByText(/¿Seguro que querés cerrar este reporte\?/)).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('cierra al confirmar', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderBoton()

    await user.click(screen.getByRole('button', { name: 'Cerrar reporte' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancelar vuelve atrás sin cerrar', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderBoton()

    await user.click(screen.getByRole('button', { name: 'Cerrar reporte' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('button', { name: 'Confirmar cierre' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar reporte' })).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('muestra el error recibido', () => {
    renderBoton({ error: 'Este reporte ya estaba cerrado.' })

    expect(screen.getByRole('alert')).toHaveTextContent('Este reporte ya estaba cerrado.')
  })
})
