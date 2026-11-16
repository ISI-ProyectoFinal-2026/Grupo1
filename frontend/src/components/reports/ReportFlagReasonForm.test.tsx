import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ReportFlagReasonForm from '@/components/reports/ReportFlagReasonForm'

function renderForm(props: Partial<ComponentProps<typeof ReportFlagReasonForm>> = {}) {
  const onSubmit = vi.fn()
  render(<ReportFlagReasonForm onSubmit={onSubmit} {...props} />)
  return { onSubmit }
}

const denunciar = () => screen.getByRole('button', { name: 'Denunciar' })
const enviar = () => screen.getByRole('button', { name: 'Enviar denuncia' })
const motivo = () => screen.getByLabelText('Motivo de la denuncia')

describe('ReportFlagReasonForm', () => {
  it('el formulario aparece recién al tocar Denunciar y ofrece los motivos tipificados', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.queryByRole('form', { name: 'Denunciar reporte' })).not.toBeInTheDocument()
    await user.click(denunciar())

    expect(screen.getByRole('form', { name: 'Denunciar reporte' })).toBeInTheDocument()
    const opciones = Array.from((motivo() as HTMLSelectElement).options).map((option) => option.text)
    expect(opciones).toEqual([
      'Elegí un motivo',
      'No es un animal',
      'Contenido ofensivo',
      'Spam o publicidad',
      'Duplicado',
      'Información falsa',
      'Otro',
    ])
  })

  it('no envía sin elegir un motivo', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.click(denunciar())
    await user.click(enviar())

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Elegí un motivo para la denuncia.')).toBeInTheDocument()
  })

  it('envía un motivo tipificado sin detalle', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.click(denunciar())
    await user.selectOptions(motivo(), 'spam')
    expect(screen.queryByLabelText('Detalle')).not.toBeInTheDocument()
    await user.click(enviar())

    expect(onSubmit).toHaveBeenCalledWith({ reason: 'spam' })
  })

  it('Otro exige un detalle no vacío', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.click(denunciar())
    await user.selectOptions(motivo(), 'other')
    await user.type(screen.getByLabelText('Detalle'), '   ')
    await user.click(enviar())

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Contanos el motivo de la denuncia.')).toBeInTheDocument()
  })

  it('Otro envía el detalle sin espacios sobrantes', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.click(denunciar())
    await user.selectOptions(motivo(), 'other')
    await user.type(screen.getByLabelText('Detalle'), '  Es una estafa ')
    await user.click(enviar())

    expect(onSubmit).toHaveBeenCalledWith({ reason: 'other', detail: 'Es una estafa' })
  })

  it('una vez enviada confirma la denuncia y deshabilita el botón', () => {
    renderForm({ isSent: true, isDone: true })

    expect(screen.getByRole('status')).toHaveTextContent('Recibimos tu denuncia')
    expect(denunciar()).toBeDisabled()
  })

  it('muestra el error recibido', () => {
    renderForm({ error: 'Ya denunciaste este reporte.' })

    expect(screen.getByRole('alert')).toHaveTextContent('Ya denunciaste este reporte.')
  })
})
