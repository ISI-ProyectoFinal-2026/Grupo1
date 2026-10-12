import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ActionErrorMessage from '@/components/auth/ActionErrorMessage'
import EmailNotVerifiedNotice from '@/components/auth/EmailNotVerifiedNotice'
import * as authService from '@/services/auth.service'
import { createQueryWrapper } from '@/test/query-wrapper'

vi.mock('@/services/auth.service')

function renderConQuery(ui: React.ReactElement) {
  const { Wrapper } = createQueryWrapper()
  return render(<Wrapper>{ui}</Wrapper>)
}

describe('EmailNotVerifiedNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('explica que falta verificar el email y ofrece reenviarlo', async () => {
    vi.mocked(authService.resendVerification).mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    renderConQuery(<EmailNotVerifiedNotice />)

    expect(screen.getByRole('alert')).toHaveTextContent('Verificá tu email para poder hacer esto')

    await user.click(screen.getByRole('button', { name: 'Reenviar email de verificación' }))

    expect(await screen.findByText('Te mandamos un nuevo email')).toBeInTheDocument()
    expect(authService.resendVerification).toHaveBeenCalledTimes(1)
  })
})

describe('ActionErrorMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // El codigo de maquina manda: el texto del backend no se usa para decidir ni
  // se muestra, la UI explica el paso que falta con su propio copy.
  it('con EMAIL_NOT_VERIFIED muestra el aviso con reenvio en lugar del mensaje crudo', () => {
    renderConQuery(
      <ActionErrorMessage message="Verificá tu email para continuar" code="EMAIL_NOT_VERIFIED" />
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Verificá tu email para poder hacer esto')
    expect(screen.getByRole('button', { name: 'Reenviar email de verificación' })).toBeEnabled()
    expect(screen.queryByText('Verificá tu email para continuar')).not.toBeInTheDocument()
  })

  it.each([undefined, 'RESEND_COOLDOWN'])(
    'con el code %s muestra el mensaje del backend sin reenvio',
    (code) => {
      renderConQuery(<ActionErrorMessage message="Reporte duplicado" code={code} />)

      expect(screen.getByRole('alert')).toHaveTextContent('Reporte duplicado')
      expect(screen.queryByRole('button', { name: 'Reenviar email de verificación' })).toBeNull()
    }
  )
})
