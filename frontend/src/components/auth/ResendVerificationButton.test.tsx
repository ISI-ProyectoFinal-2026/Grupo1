import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResendVerificationButton from '@/components/auth/ResendVerificationButton'
import * as authService from '@/services/auth.service'
import { createQueryWrapper } from '@/test/query-wrapper'

vi.mock('@/services/auth.service')

function renderBoton() {
  const { Wrapper, client } = createQueryWrapper()
  render(
    <Wrapper>
      <ResendVerificationButton />
    </Wrapper>
  )
  return { client }
}

describe('ResendVerificationButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pide otro email y confirma el envio', async () => {
    vi.mocked(authService.resendVerification).mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    renderBoton()

    await user.click(screen.getByRole('button', { name: 'Reenviar email de verificación' }))

    expect(await screen.findByText('Te mandamos un nuevo email')).toBeInTheDocument()
    expect(authService.resendVerification).toHaveBeenCalledTimes(1)
  })

  // Dentro del minuto de cooldown el backend responde 429 con el mensaje que
  // dice cuanto esperar: se muestra tal cual, sin inventar uno propio.
  it('muestra el mensaje del backend cuando hay que esperar (429)', async () => {
    vi.mocked(authService.resendVerification).mockRejectedValue(
      Object.assign(new Error('Esperá un minuto antes de pedir otro email'), {
        status: 429,
        code: 'RESEND_COOLDOWN',
      })
    )
    const user = userEvent.setup()
    renderBoton()

    await user.click(screen.getByRole('button', { name: 'Reenviar email de verificación' }))

    expect(await screen.findByText('Esperá un minuto antes de pedir otro email')).toBeInTheDocument()
    expect(screen.queryByText('Te mandamos un nuevo email')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reenviar email de verificación' })).toBeEnabled()
  })

  // Un 409 significa que el email ya quedó verificado (p. ej. en otra pestaña):
  // se refresca /me para que desaparezca el banner.
  it('trata el 409 como ya verificado y refresca /auth/me', async () => {
    vi.mocked(authService.resendVerification).mockRejectedValue(
      Object.assign(new Error('Tu email ya está verificado'), { status: 409 })
    )
    const user = userEvent.setup()
    const { client } = renderBoton()
    const invalidar = vi.spyOn(client, 'invalidateQueries')

    await user.click(screen.getByRole('button', { name: 'Reenviar email de verificación' }))

    expect(await screen.findByText('Tu email ya está verificado')).toBeInTheDocument()
    await waitFor(() =>
      expect(invalidar).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['auth', 'me'] }))
    )
  })

  it('muestra el error cuando el correo no esta configurado (503)', async () => {
    vi.mocked(authService.resendVerification).mockRejectedValue(
      Object.assign(new Error('El servicio de correo no está configurado (falta SMTP_HOST)'), {
        status: 503,
        code: 'MAIL_NOT_CONFIGURED',
      })
    )
    const user = userEvent.setup()
    renderBoton()

    await user.click(screen.getByRole('button', { name: 'Reenviar email de verificación' }))

    expect(
      await screen.findByText('El servicio de correo no está configurado (falta SMTP_HOST)')
    ).toBeInTheDocument()
  })

  it('se deshabilita mientras la peticion esta en vuelo', async () => {
    vi.mocked(authService.resendVerification).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderBoton()

    await user.click(screen.getByRole('button', { name: 'Reenviar email de verificación' }))

    expect(await screen.findByRole('button', { name: 'Enviando...' })).toBeDisabled()
  })
})
