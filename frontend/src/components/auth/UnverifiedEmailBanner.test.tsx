import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UnverifiedEmailBanner from '@/components/auth/UnverifiedEmailBanner'
import * as authService from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/auth.service')

const sinVerificar: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  role: 'usuario_regular',
  emailVerifiedAt: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

function renderBanner() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <UnverifiedEmailBanner />
    </Wrapper>
  )
}

describe('UnverifiedEmailBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('avisa a un usuario sin verificar y ofrece reenviar el email', async () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', sinVerificar)
    vi.mocked(authService.resendVerification).mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    renderBanner()

    expect(screen.getByRole('region', { name: 'Verificación de email' })).toHaveTextContent(
      'franco@patitas.test'
    )

    await user.click(screen.getByRole('button', { name: 'Reenviar email de verificación' }))

    expect(await screen.findByText('Te mandamos un nuevo email')).toBeInTheDocument()
  })

  it('muestra el mensaje de espera cuando el reenvio cae en el cooldown (429)', async () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', sinVerificar)
    vi.mocked(authService.resendVerification).mockRejectedValue(
      Object.assign(new Error('Esperá un minuto antes de pedir otro email'), { status: 429 })
    )
    const user = userEvent.setup()
    renderBanner()

    await user.click(screen.getByRole('button', { name: 'Reenviar email de verificación' }))

    expect(await screen.findByText('Esperá un minuto antes de pedir otro email')).toBeInTheDocument()
  })

  it('desaparece cuando el usuario queda verificado', () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', sinVerificar)
    renderBanner()
    expect(screen.getByRole('region', { name: 'Verificación de email' })).toBeInTheDocument()

    act(() => {
      useAuthStore.getState().setUser({ ...sinVerificar, emailVerifiedAt: '2026-09-02T10:00:00.000Z' })
    })

    expect(screen.queryByRole('region', { name: 'Verificación de email' })).not.toBeInTheDocument()
  })

  it('no aparece para un usuario ya verificado', () => {
    useAuthStore
      .getState()
      .setAuth('jwt-de-prueba', { ...sinVerificar, emailVerifiedAt: '2026-09-02T10:00:00.000Z' })

    renderBanner()

    expect(screen.queryByRole('region', { name: 'Verificación de email' })).not.toBeInTheDocument()
  })

  // Una sesion guardada antes de existir el campo no trae emailVerifiedAt: es
  // "no se sabe", y /me lo resuelve; no corresponde asustar al usuario.
  it('no aparece con una sesion vieja sin el campo', () => {
    const vieja = { ...sinVerificar } as Partial<AuthUser>
    delete vieja.emailVerifiedAt
    useAuthStore.getState().setAuth('jwt-de-prueba', vieja as AuthUser)

    renderBanner()

    expect(screen.queryByRole('region', { name: 'Verificación de email' })).not.toBeInTheDocument()
  })

  it('no aparece sin sesion', () => {
    renderBanner()

    expect(screen.queryByRole('region', { name: 'Verificación de email' })).not.toBeInTheDocument()
  })
})
