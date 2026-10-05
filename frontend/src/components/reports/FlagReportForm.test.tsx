import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FlagReportForm from '@/components/reports/FlagReportForm'

function renderForm(props: Partial<ComponentProps<typeof FlagReportForm>> = {}) {
  const onSubmit = vi.fn()
  render(<FlagReportForm onSubmit={onSubmit} {...props} />)
  return { onSubmit }
}

const denunciar = () => screen.getByRole('button', { name: 'Denunciar' })

describe('FlagReportForm', () => {
  it('el formulario aparece recién al tocar Denunciar', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.queryByRole('form', { name: 'Denunciar reporte' })).not.toBeInTheDocument()
    await user.click(denunciar())

    expect(screen.getByRole('form', { name: 'Denunciar reporte' })).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo de la denuncia')).toBeInTheDocument()
  })

  it('no envía un motivo vacío o solo con espacios', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.click(denunciar())
    await user.type(screen.getByLabelText('Motivo de la denuncia'), '   ')
    await user.click(screen.getByRole('button', { name: 'Enviar denuncia' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Contanos el motivo de la denuncia.')).toBeInTheDocument()
  })

  it('envía el motivo sin espacios sobrantes', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.click(denunciar())
    await user.type(screen.getByLabelText('Motivo de la denuncia'), '  Es una estafa ')
    await user.click(screen.getByRole('button', { name: 'Enviar denuncia' }))

    expect(onSubmit).toHaveBeenCalledWith('Es una estafa')
  })

  it('una vez enviada confirma la denuncia y deshabilita el botón', () => {
    renderForm({ isSent: true, isDone: true })

    expect(screen.getByRole('status')).toHaveTextContent('Recibimos tu denuncia')
    expect(denunciar()).toBeDisabled()
    expect(screen.queryByRole('form', { name: 'Denunciar reporte' })).not.toBeInTheDocument()
  })

  it('si ya estaba denunciado muestra el aviso y deshabilita el botón', () => {
    renderForm({ isDone: true, error: 'Ya denunciaste este reporte.' })

    expect(screen.getByRole('alert')).toHaveTextContent('Ya denunciaste este reporte.')
    expect(denunciar()).toBeDisabled()
  })
})
