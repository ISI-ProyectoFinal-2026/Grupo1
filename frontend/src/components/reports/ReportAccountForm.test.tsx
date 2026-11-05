import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportAccountForm from '@/components/reports/ReportAccountForm'
import * as moderationService from '@/services/moderation.service'
import { createQueryWrapper } from '@/test/query-wrapper'

vi.mock('@/services/moderation.service')

function renderForm() {
  const { Wrapper } = createQueryWrapper()
  render(
    <Wrapper>
      <ReportAccountForm reportedUserId={42} />
    </Wrapper>
  )
}

function errorConStatus(message: string, status: number) {
  return Object.assign(new Error(message), { status })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReportAccountForm', () => {
  it('ofrece las tres gravedades al abrirlo', async () => {
    renderForm()

    await userEvent.click(screen.getByRole('button', { name: 'Reportar cuenta' }))

    expect(screen.getByRole('radio', { name: 'Leve' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Media' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Fuerte' })).toBeInTheDocument()
  })

  it('exige elegir una gravedad antes de enviar', async () => {
    renderForm()

    await userEvent.click(screen.getByRole('button', { name: 'Reportar cuenta' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }))

    expect(screen.getByText('Elegí la gravedad del problema.')).toBeInTheDocument()
    expect(moderationService.createAccountReport).not.toHaveBeenCalled()
  })

  it('envía la gravedad elegida y confirma la denuncia', async () => {
    vi.mocked(moderationService.createAccountReport).mockResolvedValue({
      id: 1,
      reportedUserId: 42,
      reporterId: 7,
      severity: 'moderate',
      createdAt: '2026-11-03T10:00:00.000Z',
    })
    renderForm()

    await userEvent.click(screen.getByRole('button', { name: 'Reportar cuenta' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Media' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }))

    expect(moderationService.createAccountReport).toHaveBeenCalledWith(42, 'moderate')
    expect(await screen.findByText('Recibimos tu reporte. Gracias por avisar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reportar cuenta' })).toBeDisabled()
  })

  it('avisa si ya había reportado la cuenta y no deja reintentar', async () => {
    vi.mocked(moderationService.createAccountReport).mockRejectedValue(errorConStatus('Ya reportaste esta cuenta', 409))
    renderForm()

    await userEvent.click(screen.getByRole('button', { name: 'Reportar cuenta' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Leve' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }))

    expect(await screen.findByText('Ya reportaste esta cuenta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reportar cuenta' })).toBeDisabled()
  })

  it('muestra el mensaje del servidor si la cuenta ya tiene una sanción en curso', async () => {
    vi.mocked(moderationService.createAccountReport).mockRejectedValue(
      errorConStatus('La cuenta ya tiene una sanción en curso', 409)
    )
    renderForm()

    await userEvent.click(screen.getByRole('button', { name: 'Reportar cuenta' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Leve' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }))

    expect(await screen.findByText('La cuenta ya tiene una sanción en curso')).toBeInTheDocument()
    expect(screen.queryByText('Ya reportaste esta cuenta.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reportar cuenta' })).toBeDisabled()
  })

  it('cancelar cierra el formulario sin enviar', async () => {
    renderForm()

    await userEvent.click(screen.getByRole('button', { name: 'Reportar cuenta' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('radio', { name: 'Leve' })).not.toBeInTheDocument()
    expect(moderationService.createAccountReport).not.toHaveBeenCalled()
  })
})
