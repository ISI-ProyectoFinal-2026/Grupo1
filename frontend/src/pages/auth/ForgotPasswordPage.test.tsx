import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import * as authService from '@/services/auth.service'
import { createQueryWrapper } from '@/test/query-wrapper'

vi.mock('@/services/auth.service')

const NEUTRAL = 'Si el email está registrado, te enviamos un enlace para restablecer tu contraseña'

function renderPagina() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<div>Pantalla de login</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

async function enviar(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza el formulario y el link de vuelta al login', () => {
    renderPagina()

    expect(screen.getByRole('heading', { name: 'Recuperar contraseña' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute(
      'href',
      '/login'
    )
  })

  // La confirmacion es la misma exista o no la cuenta (el backend tambien
  // responde igual): la pantalla no puede ser un oraculo de emails.
  it.each(['franco@patitas.test', 'nadie@patitas.test'])(
    'muestra la misma confirmacion neutral para %s',
    async (email) => {
      vi.mocked(authService.forgotPassword).mockResolvedValue({ message: NEUTRAL })
      const user = userEvent.setup()
      renderPagina()

      await enviar(user, email)

      expect(await screen.findByText(NEUTRAL)).toBeInTheDocument()
      expect(authService.forgotPassword).toHaveBeenCalledWith(email)
      expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    }
  )

  it('muestra el 503 cuando el correo no esta configurado y conserva el formulario', async () => {
    vi.mocked(authService.forgotPassword).mockRejectedValue(
      Object.assign(new Error('El servicio de correo no está configurado (falta SMTP_HOST)'), {
        status: 503,
        code: 'MAIL_NOT_CONFIGURED',
      })
    )
    const user = userEvent.setup()
    renderPagina()

    await enviar(user, 'franco@patitas.test')

    expect(
      await screen.findByText('El servicio de correo no está configurado (falta SMTP_HOST)')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('franco@patitas.test')
    expect(screen.queryByText(NEUTRAL)).not.toBeInTheDocument()
  })

  it('deshabilita el boton mientras la peticion esta en vuelo', async () => {
    vi.mocked(authService.forgotPassword).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderPagina()

    await enviar(user, 'franco@patitas.test')

    expect(await screen.findByRole('button', { name: 'Enviando...' })).toBeDisabled()
  })
})
