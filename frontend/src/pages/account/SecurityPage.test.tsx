import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SecurityPage from '@/pages/account/SecurityPage'
import * as authService from '@/services/auth.service'
import * as twoFactorService from '@/services/two-factor.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AuthUser, TwoFactorStatus } from '@/types/auth'

vi.mock('@/services/two-factor.service')
vi.mock('@/services/auth.service')
// El QR real es un SVG ilegible para un test: se reemplaza por uno que expone
// lo que codifica, que es lo que importa (el URI otpauth del backend).
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg role='img' aria-label={title} data-value={value} />
  ),
}))

const usuario: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: 'Franco',
  phone: null,
  role: 'usuario_regular',
  emailVerifiedAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  twoFactorEnabled: false,
}

const usuarioConDosPasos: AuthUser = { ...usuario, twoFactorEnabled: true }

const SECRETO = 'JBSWY3DPEHPK3PXP'
const URI = `otpauth://totp/PATITAS:franco%40patitas.test?secret=${SECRETO}&issuer=PATITAS`
const CODIGOS = ['AAAAA-BBBBB', 'CCCCC-DDDDD', 'EEEEE-FFFFF', 'GGGGG-HHHHH']
const CODIGOS_NUEVOS = ['ZZZZZ-YYYYY', 'XXXXX-WWWWW']

const desactivado: TwoFactorStatus = {
  enabled: false,
  recoveryCodesRemaining: 0,
  resetEffectiveAt: null,
}

function activado(overrides: Partial<TwoFactorStatus> = {}): TwoFactorStatus {
  return { enabled: true, recoveryCodesRemaining: 8, resetEffectiveAt: null, ...overrides }
}

function errorApi(message: string, status: number, code?: string, details?: unknown) {
  return Object.assign(new Error(message), { status, code, details })
}

function renderPagina() {
  const { Wrapper, client } = createQueryWrapper()
  render(
    <Wrapper>
      <SecurityPage />
    </Wrapper>
  )
  return client
}

function seccion(nombre: string) {
  return within(screen.getByRole('region', { name: nombre }))
}

async function esperarEstado() {
  await screen.findByRole('heading', { name: 'Seguridad de la cuenta' })
  await waitFor(() =>
    expect(screen.queryByRole('status', { name: 'Cargando' })).not.toBeInTheDocument()
  )
}

async function iniciarActivacion(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Activar verificación en dos pasos' }))
  await screen.findByRole('img', { name: 'Código QR para tu app de autenticación' })
}

describe('SecurityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setAuth('jwt-viejo', usuario)
    vi.mocked(twoFactorService.getTwoFactorStatus).mockResolvedValue(desactivado)
    vi.mocked(twoFactorService.setupTwoFactor).mockResolvedValue({
      secret: SECRETO,
      otpauthUri: URI,
    })
  })

  afterEach(() => {
    useAuthStore.getState().logout()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  describe('estado', () => {
    it('muestra un indicador de carga mientras pide el estado', () => {
      vi.mocked(twoFactorService.getTwoFactorStatus).mockReturnValue(new Promise(() => {}))

      renderPagina()

      expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Activar verificación en dos pasos' })
      ).not.toBeInTheDocument()
    })

    it('si falla pedir el estado muestra el error y deja reintentar', async () => {
      vi.mocked(twoFactorService.getTwoFactorStatus)
        .mockRejectedValueOnce(errorApi('No se pudo cargar el estado', 500))
        .mockResolvedValueOnce(desactivado)
      const user = userEvent.setup()
      renderPagina()

      expect(await screen.findByText('No se pudo cargar el estado')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Reintentar' }))

      expect(
        await screen.findByRole('button', { name: 'Activar verificación en dos pasos' })
      ).toBeInTheDocument()
      expect(useAuthStore.getState().token).toBe('jwt-viejo')
    })
  })

  describe('desactivado', () => {
    it('ofrece activar la verificacion y todavia no pide nada al backend', async () => {
      renderPagina()

      expect(
        await screen.findByRole('button', { name: 'Activar verificación en dos pasos' })
      ).toBeEnabled()
      expect(screen.getByRole('heading', { name: 'Seguridad de la cuenta' })).toBeInTheDocument()
      expect(twoFactorService.setupTwoFactor).not.toHaveBeenCalled()
      expect(
        screen.queryByRole('region', { name: 'Códigos de recuperación' })
      ).not.toBeInTheDocument()
    })

    it('un usuario sin email verificado ve la explicacion y reenviar, sin boton de activar', async () => {
      useAuthStore.getState().setAuth('jwt-viejo', { ...usuario, emailVerifiedAt: null })
      vi.mocked(authService.resendVerification).mockResolvedValue({ message: 'Enviado' })
      const user = userEvent.setup()
      renderPagina()

      expect(await screen.findByText(/primero tenés que verificar tu email/)).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Activar verificación en dos pasos' })
      ).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Reenviar email de verificación' }))

      expect(authService.resendVerification).toHaveBeenCalledTimes(1)
      expect(await screen.findByText('Te mandamos un nuevo email')).toBeInTheDocument()
      expect(twoFactorService.setupTwoFactor).not.toHaveBeenCalled()
    })

    it('al activar muestra el QR del URI otpauth y la clave para ingresar a mano', async () => {
      const user = userEvent.setup()
      renderPagina()

      await iniciarActivacion(user)

      expect(twoFactorService.setupTwoFactor).toHaveBeenCalledTimes(1)
      expect(
        screen.getByRole('img', { name: 'Código QR para tu app de autenticación' })
      ).toHaveAttribute('data-value', URI)
      expect(screen.getByText(SECRETO)).toBeInTheDocument()
      expect(screen.getByLabelText('Código de 6 dígitos')).toBeRequired()
      expect(
        screen.queryByRole('button', { name: 'Activar verificación en dos pasos' })
      ).not.toBeInTheDocument()
    })

    it('no deja pedir el setup dos veces mientras esta en vuelo', async () => {
      vi.mocked(twoFactorService.setupTwoFactor).mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPagina()

      await user.click(
        await screen.findByRole('button', { name: 'Activar verificación en dos pasos' })
      )
      const enVuelo = await screen.findByRole('button', { name: 'Preparando...' })
      await user.click(enVuelo)

      expect(enVuelo).toBeDisabled()
      expect(twoFactorService.setupTwoFactor).toHaveBeenCalledTimes(1)
    })

    it('un 403 EMAIL_NOT_VERIFIED del backend muestra el aviso con reenviar, sin QR', async () => {
      vi.mocked(twoFactorService.setupTwoFactor).mockRejectedValue(
        errorApi('Verificá tu email', 403, 'EMAIL_NOT_VERIFIED')
      )
      const user = userEvent.setup()
      renderPagina()

      await user.click(
        await screen.findByRole('button', { name: 'Activar verificación en dos pasos' })
      )

      expect(await screen.findByText(/Verificá tu email para poder hacer esto/)).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Reenviar email de verificación' })
      ).toBeInTheDocument()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(useAuthStore.getState().token).toBe('jwt-viejo')
    })

    it('cualquier otro error al iniciar se muestra inline y deja reintentar', async () => {
      vi.mocked(twoFactorService.setupTwoFactor)
        .mockRejectedValueOnce(errorApi('La verificación en dos pasos no está configurada', 503))
        .mockResolvedValueOnce({ secret: SECRETO, otpauthUri: URI })
      const user = userEvent.setup()
      renderPagina()

      await user.click(
        await screen.findByRole('button', { name: 'Activar verificación en dos pasos' })
      )
      expect(
        await screen.findByText('La verificación en dos pasos no está configurada')
      ).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Activar verificación en dos pasos' }))

      expect(
        await screen.findByRole('img', { name: 'Código QR para tu app de autenticación' })
      ).toBeInTheDocument()
      expect(
        screen.queryByText('La verificación en dos pasos no está configurada')
      ).not.toBeInTheDocument()
    })

    it('cancelar la activacion vuelve al inicio y borra el secreto de la pantalla', async () => {
      const user = userEvent.setup()
      renderPagina()
      await iniciarActivacion(user)

      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByText(SECRETO)).not.toBeInTheDocument()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Activar verificación en dos pasos' })
      ).toBeInTheDocument()
    })
  })

  describe('confirmar la activacion', () => {
    it('manda el codigo, guarda el token nuevo y abre los codigos de recuperacion', async () => {
      vi.mocked(twoFactorService.enableTwoFactor).mockResolvedValue({
        token: 'jwt-nuevo',
        user: usuarioConDosPasos,
        recoveryCodes: CODIGOS,
      })
      vi.mocked(twoFactorService.getTwoFactorStatus)
        .mockResolvedValueOnce(desactivado)
        .mockResolvedValue(activado({ recoveryCodesRemaining: 4 }))
      const user = userEvent.setup()
      renderPagina()
      await iniciarActivacion(user)

      await user.type(screen.getByLabelText('Código de 6 dígitos'), '123456')
      await user.click(screen.getByRole('button', { name: 'Confirmar y activar' }))

      const dialogo = await screen.findByRole('dialog', { name: 'Tus códigos de recuperación' })
      expect(twoFactorService.enableTwoFactor).toHaveBeenCalledWith({ code: '123456' })
      expect(within(dialogo).getAllByRole('listitem')).toHaveLength(4)
      expect(within(dialogo).getByText('AAAAA-BBBBB')).toBeInTheDocument()
      expect(useAuthStore.getState().token).toBe('jwt-nuevo')
      expect(useAuthStore.getState().user).toEqual(usuarioConDosPasos)
    })

    it('el token nuevo ya esta guardado cuando se vuelve a pedir el estado', async () => {
      vi.mocked(twoFactorService.enableTwoFactor).mockResolvedValue({
        token: 'jwt-nuevo',
        user: usuarioConDosPasos,
        recoveryCodes: CODIGOS,
      })
      const tokensAlPedir: Array<string | null> = []
      let llamadas = 0
      vi.mocked(twoFactorService.getTwoFactorStatus).mockImplementation(async () => {
        tokensAlPedir.push(useAuthStore.getState().token)
        llamadas += 1
        return llamadas === 1 ? desactivado : activado()
      })
      const user = userEvent.setup()
      renderPagina()
      await iniciarActivacion(user)

      await user.type(screen.getByLabelText('Código de 6 dígitos'), '123456')
      await user.click(screen.getByRole('button', { name: 'Confirmar y activar' }))
      await screen.findByRole('dialog')

      await waitFor(() => expect(tokensAlPedir).toHaveLength(2))
      expect(tokensAlPedir).toEqual(['jwt-viejo', 'jwt-nuevo'])
    })

    it('saca los espacios de un codigo pegado como "123 456"', async () => {
      vi.mocked(twoFactorService.enableTwoFactor).mockResolvedValue({
        token: 'jwt-nuevo',
        user: usuarioConDosPasos,
        recoveryCodes: CODIGOS,
      })
      const user = userEvent.setup()
      renderPagina()
      await iniciarActivacion(user)

      await user.type(screen.getByLabelText('Código de 6 dígitos'), '123 456')
      await user.click(screen.getByRole('button', { name: 'Confirmar y activar' }))
      await screen.findByRole('dialog')

      expect(twoFactorService.enableTwoFactor).toHaveBeenCalledWith({ code: '123456' })
    })

    it('un codigo incorrecto (400) se muestra inline, conserva la pantalla y no cierra la sesion', async () => {
      vi.mocked(twoFactorService.enableTwoFactor)
        .mockRejectedValueOnce(errorApi('El código es inválido o expiró', 400))
        .mockResolvedValueOnce({
          token: 'jwt-nuevo',
          user: usuarioConDosPasos,
          recoveryCodes: CODIGOS,
        })
      const user = userEvent.setup()
      renderPagina()
      await iniciarActivacion(user)

      await user.type(screen.getByLabelText('Código de 6 dígitos'), '000000')
      await user.click(screen.getByRole('button', { name: 'Confirmar y activar' }))

      expect(await screen.findByText('El código es inválido o expiró')).toBeInTheDocument()
      expect(screen.getByText(SECRETO)).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(useAuthStore.getState().token).toBe('jwt-viejo')
      expect(useAuthStore.getState().user).toEqual(usuario)

      await user.clear(screen.getByLabelText('Código de 6 dígitos'))
      await user.type(screen.getByLabelText('Código de 6 dígitos'), '654321')
      await user.click(screen.getByRole('button', { name: 'Confirmar y activar' }))

      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.queryByText('El código es inválido o expiró')).not.toBeInTheDocument()
    })

    it('un 429 del limitador muestra su mensaje y no cierra la sesion', async () => {
      vi.mocked(twoFactorService.enableTwoFactor).mockRejectedValue(
        errorApi('Demasiados intentos, esperá unos minutos', 429)
      )
      const user = userEvent.setup()
      renderPagina()
      await iniciarActivacion(user)

      await user.type(screen.getByLabelText('Código de 6 dígitos'), '123456')
      await user.click(screen.getByRole('button', { name: 'Confirmar y activar' }))

      expect(
        await screen.findByText('Demasiados intentos, esperá unos minutos')
      ).toBeInTheDocument()
      expect(useAuthStore.getState().token).toBe('jwt-viejo')
    })
  })

  describe('modal de codigos de recuperacion', () => {
    async function activarYAbrirModal(user: ReturnType<typeof userEvent.setup>) {
      vi.mocked(twoFactorService.enableTwoFactor).mockResolvedValue({
        token: 'jwt-nuevo',
        user: usuarioConDosPasos,
        recoveryCodes: CODIGOS,
      })
      vi.mocked(twoFactorService.getTwoFactorStatus)
        .mockResolvedValueOnce(desactivado)
        .mockResolvedValue(activado({ recoveryCodesRemaining: 4 }))
      const client = renderPagina()
      await iniciarActivacion(user)
      await user.type(screen.getByLabelText('Código de 6 dígitos'), '123456')
      await user.click(screen.getByRole('button', { name: 'Confirmar y activar' }))
      await screen.findByRole('dialog', { name: 'Tus códigos de recuperación' })
      return client
    }

    it('no se puede cerrar con Escape ni con el fondo antes de confirmar', async () => {
      const user = userEvent.setup()
      await activarYAbrirModal(user)

      await user.keyboard('{Escape}')
      await user.click(screen.getByTestId('recovery-codes-overlay'))

      expect(
        screen.getByRole('dialog', { name: 'Tus códigos de recuperación' })
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled()
    })

    it('al confirmar que los guardo se cierra, y deja el panel de 2FA activado', async () => {
      const user = userEvent.setup()
      await activarYAbrirModal(user)

      await user.click(screen.getByRole('checkbox', { name: 'Guardé mis códigos' }))
      await user.click(screen.getByRole('button', { name: 'Cerrar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await screen.findByText('Te quedan 4 códigos de recuperación.')).toBeInTheDocument()
      expect(screen.queryByText('AAAAA-BBBBB')).not.toBeInTheDocument()
      expect(screen.queryByText(SECRETO)).not.toBeInTheDocument()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('el secreto y los codigos no quedan en el storage ni en la cache de TanStack', async () => {
      const user = userEvent.setup()
      const client = await activarYAbrirModal(user)
      await user.click(screen.getByRole('checkbox', { name: 'Guardé mis códigos' }))
      await user.click(screen.getByRole('button', { name: 'Cerrar' }))
      await screen.findByText('Te quedan 4 códigos de recuperación.')

      const almacenado =
        JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage })
      expect(almacenado).toContain('jwt-nuevo')
      for (const secreto of [SECRETO, URI, ...CODIGOS]) {
        expect(almacenado).not.toContain(secreto)
      }
      const cacheDeQueries = JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data)
      )
      for (const secreto of [SECRETO, URI, ...CODIGOS]) {
        expect(cacheDeQueries).not.toContain(secreto)
      }
      await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0))
    })
  })

  describe('activado', () => {
    beforeEach(() => {
      useAuthStore.getState().setAuth('jwt-viejo', usuarioConDosPasos)
    })

    it('muestra que esta activada y cuantos codigos de recuperacion quedan', async () => {
      vi.mocked(twoFactorService.getTwoFactorStatus).mockResolvedValue(
        activado({ recoveryCodesRemaining: 8 })
      )
      renderPagina()

      expect(await screen.findByText('Te quedan 8 códigos de recuperación.')).toBeInTheDocument()
      expect(screen.getByText('La verificación en dos pasos está activada.')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Activar verificación en dos pasos' })
      ).not.toBeInTheDocument()
    })

    it.each([[3], [2], [1], [0]])(
      'con %i codigos restantes avisa que quedan pocos',
      async (restantes) => {
        vi.mocked(twoFactorService.getTwoFactorStatus).mockResolvedValue(
          activado({ recoveryCodesRemaining: restantes })
        )
        renderPagina()

        expect(await screen.findByText(/Quedan pocos códigos de recuperación/)).toBeInTheDocument()
      }
    )

    it.each([[4], [5], [10]])('con %i codigos restantes no muestra el aviso', async (restantes) => {
      vi.mocked(twoFactorService.getTwoFactorStatus).mockResolvedValue(
        activado({ recoveryCodesRemaining: restantes })
      )
      renderPagina()

      expect(
        await screen.findByText(`Te quedan ${restantes} códigos de recuperación.`)
      ).toBeInTheDocument()
      expect(screen.queryByText(/Quedan pocos códigos de recuperación/)).not.toBeInTheDocument()
    })

    it('usa el singular con un solo codigo', async () => {
      vi.mocked(twoFactorService.getTwoFactorStatus).mockResolvedValue(
        activado({ recoveryCodesRemaining: 1 })
      )
      renderPagina()

      expect(await screen.findByText('Te queda 1 código de recuperación.')).toBeInTheDocument()
    })

    it('con un reinicio pendiente muestra cuando se completa', async () => {
      vi.mocked(twoFactorService.getTwoFactorStatus).mockResolvedValue(
        activado({ resetEffectiveAt: '2026-10-20T12:00:00.000Z' })
      )
      renderPagina()

      const aviso = await screen.findByText(
        /Hay un reinicio de la verificación en dos pasos en curso/
      )
      expect(aviso).toHaveTextContent(/octubre de 2026/)
    })

    it('sin reinicio pendiente no muestra ese aviso', async () => {
      vi.mocked(twoFactorService.getTwoFactorStatus).mockResolvedValue(activado())
      renderPagina()

      await screen.findByText('Te quedan 8 códigos de recuperación.')
      expect(screen.queryByText(/reinicio de la verificación/)).not.toBeInTheDocument()
    })

    describe('regenerar codigos', () => {
      beforeEach(() => {
        vi.mocked(twoFactorService.getTwoFactorStatus).mockResolvedValue(
          activado({ recoveryCodesRemaining: 2 })
        )
      })

      it('pide solo el codigo de la app, guarda el token nuevo y muestra el MISMO modal bloqueado', async () => {
        vi.mocked(twoFactorService.regenerateRecoveryCodes).mockResolvedValue({
          token: 'jwt-nuevo',
          user: usuarioConDosPasos,
          recoveryCodes: CODIGOS_NUEVOS,
        })
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Generar códigos de recuperación nuevos')

        expect(formulario.queryByLabelText('Contraseña')).not.toBeInTheDocument()
        expect(formulario.queryByRole('button', { name: /recuperación/i })).not.toBeInTheDocument()
        await user.type(formulario.getByLabelText('Código de tu app'), '654321')
        await user.click(formulario.getByRole('button', { name: 'Generar códigos nuevos' }))

        const dialogo = await screen.findByRole('dialog', { name: 'Tus códigos de recuperación' })
        expect(twoFactorService.regenerateRecoveryCodes).toHaveBeenCalledWith({ code: '654321' })
        expect(within(dialogo).getAllByRole('listitem')).toHaveLength(2)
        expect(within(dialogo).getByText('ZZZZZ-YYYYY')).toBeInTheDocument()
        expect(useAuthStore.getState().token).toBe('jwt-nuevo')

        await user.keyboard('{Escape}')
        await user.click(screen.getByTestId('recovery-codes-overlay'))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled()

        await user.click(screen.getByRole('checkbox', { name: 'Guardé mis códigos' }))
        await user.click(screen.getByRole('button', { name: 'Cerrar' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.queryByText('ZZZZZ-YYYYY')).not.toBeInTheDocument()
      })

      it('despues de regenerar vacia el campo del codigo ya usado', async () => {
        vi.mocked(twoFactorService.regenerateRecoveryCodes).mockResolvedValue({
          token: 'jwt-nuevo',
          user: usuarioConDosPasos,
          recoveryCodes: CODIGOS_NUEVOS,
        })
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Generar códigos de recuperación nuevos')

        await user.type(formulario.getByLabelText('Código de tu app'), '654321')
        await user.click(formulario.getByRole('button', { name: 'Generar códigos nuevos' }))
        await screen.findByRole('dialog')

        // El formulario se vuelve a montar al regenerar: hay que buscarlo de nuevo.
        expect(
          seccion('Generar códigos de recuperación nuevos').getByLabelText('Código de tu app')
        ).toHaveValue('')
      })

      it('un codigo incorrecto (400) se muestra inline y no cierra la sesion', async () => {
        vi.mocked(twoFactorService.regenerateRecoveryCodes).mockRejectedValue(
          errorApi('El código es inválido o expiró', 400)
        )
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Generar códigos de recuperación nuevos')

        await user.type(formulario.getByLabelText('Código de tu app'), '000000')
        await user.click(formulario.getByRole('button', { name: 'Generar códigos nuevos' }))

        expect(await formulario.findByText('El código es inválido o expiró')).toBeInTheDocument()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(useAuthStore.getState().token).toBe('jwt-viejo')
        expect(useAuthStore.getState().user).toEqual(usuarioConDosPasos)
      })

      it('el bloqueo (429) explica cuanto esperar y conserva la pantalla', async () => {
        vi.mocked(twoFactorService.regenerateRecoveryCodes).mockRejectedValue(
          errorApi('Cuenta bloqueada', 429, 'TWO_FACTOR_LOCKED', { retryAfterSeconds: 900 })
        )
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Generar códigos de recuperación nuevos')

        await user.type(formulario.getByLabelText('Código de tu app'), '123456')
        await user.click(formulario.getByRole('button', { name: 'Generar códigos nuevos' }))

        expect(
          await formulario.findByText('Demasiados intentos fallidos. Probá de nuevo en 15 minutos')
        ).toBeInTheDocument()
        expect(useAuthStore.getState().token).toBe('jwt-viejo')
      })

      it('mientras esta en vuelo deshabilita el boton: un doble click es un solo pedido', async () => {
        vi.mocked(twoFactorService.regenerateRecoveryCodes).mockReturnValue(new Promise(() => {}))
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Generar códigos de recuperación nuevos')

        await user.type(formulario.getByLabelText('Código de tu app'), '123456')
        await user.click(formulario.getByRole('button', { name: 'Generar códigos nuevos' }))
        const enVuelo = await formulario.findByRole('button', { name: 'Generando...' })
        await user.click(enVuelo)

        expect(enVuelo).toBeDisabled()
        expect(twoFactorService.regenerateRecoveryCodes).toHaveBeenCalledTimes(1)
      })
    })

    describe('desactivar', () => {
      beforeEach(() => {
        vi.mocked(twoFactorService.getTwoFactorStatus)
          .mockResolvedValueOnce(activado())
          .mockResolvedValue(desactivado)
      })

      it('manda contraseña y codigo, guarda el token nuevo y vuelve al estado desactivado', async () => {
        vi.mocked(twoFactorService.disableTwoFactor).mockResolvedValue({
          token: 'jwt-nuevo',
          user: usuario,
        })
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Desactivar la verificación en dos pasos')

        await user.type(formulario.getByLabelText('Contraseña'), 'Secreta123')
        await user.type(formulario.getByLabelText('Código de tu app'), '123 456')
        await user.click(
          formulario.getByRole('button', { name: 'Desactivar verificación en dos pasos' })
        )

        expect(
          await screen.findByRole('button', { name: 'Activar verificación en dos pasos' })
        ).toBeInTheDocument()
        expect(twoFactorService.disableTwoFactor).toHaveBeenCalledWith({
          password: 'Secreta123',
          code: '123456',
        })
        expect(useAuthStore.getState().token).toBe('jwt-nuevo')
        expect(useAuthStore.getState().user).toEqual(usuario)
        expect(screen.queryByText(/códigos de recuperación\./)).not.toBeInTheDocument()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      it('con el interruptor manda el codigo de recuperacion junto con la contraseña', async () => {
        vi.mocked(twoFactorService.disableTwoFactor).mockResolvedValue({
          token: 'jwt-nuevo',
          user: usuario,
        })
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Desactivar la verificación en dos pasos')

        await user.click(formulario.getByRole('button', { name: 'Usar un código de recuperación' }))
        expect(formulario.queryByLabelText('Código de tu app')).not.toBeInTheDocument()
        await user.type(formulario.getByLabelText('Contraseña'), 'Secreta123')
        await user.type(formulario.getByLabelText('Código de recuperación'), ' ABCDE FGHIJ ')
        await user.click(
          formulario.getByRole('button', { name: 'Desactivar verificación en dos pasos' })
        )

        await screen.findByRole('button', { name: 'Activar verificación en dos pasos' })
        // Solo se recortan los bordes: el backend ya ignora guion, espacios y mayusculas.
        expect(twoFactorService.disableTwoFactor).toHaveBeenCalledWith({
          password: 'Secreta123',
          code: 'ABCDE FGHIJ',
        })
      })

      it('cambiar de tipo de codigo vacia el campo y se puede volver al de la app', async () => {
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Desactivar la verificación en dos pasos')

        await user.type(formulario.getByLabelText('Código de tu app'), '123456')
        await user.click(formulario.getByRole('button', { name: 'Usar un código de recuperación' }))
        expect(formulario.getByLabelText('Código de recuperación')).toHaveValue('')
        await user.click(formulario.getByRole('button', { name: 'Usar el código de mi app' }))

        expect(formulario.getByLabelText('Código de tu app')).toHaveValue('')
      })

      it('un codigo incorrecto (400) se muestra inline, sigue activada y no cierra la sesion', async () => {
        vi.mocked(twoFactorService.disableTwoFactor).mockRejectedValue(
          errorApi('El código es inválido o expiró', 400, 'INVALID_TWO_FACTOR_CODE')
        )
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Desactivar la verificación en dos pasos')

        await user.type(formulario.getByLabelText('Contraseña'), 'Secreta123')
        await user.type(formulario.getByLabelText('Código de tu app'), '000000')
        await user.click(
          formulario.getByRole('button', { name: 'Desactivar verificación en dos pasos' })
        )

        expect(await formulario.findByText('El código es inválido o expiró')).toBeInTheDocument()
        expect(useAuthStore.getState().token).toBe('jwt-viejo')
        expect(useAuthStore.getState().user).toEqual(usuarioConDosPasos)
        expect(screen.getByText('La verificación en dos pasos está activada.')).toBeInTheDocument()
      })

      it('una contraseña incorrecta (403) se muestra inline y no cierra la sesion', async () => {
        vi.mocked(twoFactorService.disableTwoFactor).mockRejectedValue(
          errorApi('La contraseña es incorrecta', 403, 'INVALID_PASSWORD')
        )
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Desactivar la verificación en dos pasos')

        await user.type(formulario.getByLabelText('Contraseña'), 'mala')
        await user.type(formulario.getByLabelText('Código de tu app'), '123456')
        await user.click(
          formulario.getByRole('button', { name: 'Desactivar verificación en dos pasos' })
        )

        expect(await formulario.findByText('La contraseña es incorrecta')).toBeInTheDocument()
        expect(useAuthStore.getState().token).toBe('jwt-viejo')
        expect(formulario.getByLabelText('Contraseña')).toHaveValue('mala')
      })

      it('el bloqueo (429) explica cuanto esperar y no cierra la sesion', async () => {
        vi.mocked(twoFactorService.disableTwoFactor).mockRejectedValue(
          errorApi('Cuenta bloqueada', 429, 'TWO_FACTOR_LOCKED', { retryAfterSeconds: 900 })
        )
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Desactivar la verificación en dos pasos')

        await user.type(formulario.getByLabelText('Contraseña'), 'Secreta123')
        await user.type(formulario.getByLabelText('Código de tu app'), '123456')
        await user.click(
          formulario.getByRole('button', { name: 'Desactivar verificación en dos pasos' })
        )

        expect(
          await formulario.findByText('Demasiados intentos fallidos. Probá de nuevo en 15 minutos')
        ).toBeInTheDocument()
        expect(useAuthStore.getState().token).toBe('jwt-viejo')
      })

      it('exige contraseña y codigo antes de mandar nada', async () => {
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Desactivar la verificación en dos pasos')

        expect(formulario.getByLabelText('Contraseña')).toBeRequired()
        expect(formulario.getByLabelText('Código de tu app')).toBeRequired()
        await user.click(
          formulario.getByRole('button', { name: 'Desactivar verificación en dos pasos' })
        )

        expect(twoFactorService.disableTwoFactor).not.toHaveBeenCalled()
      })

      it('mientras esta en vuelo deshabilita el boton: un doble click es un solo pedido', async () => {
        vi.mocked(twoFactorService.disableTwoFactor).mockReturnValue(new Promise(() => {}))
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Desactivar la verificación en dos pasos')

        await user.type(formulario.getByLabelText('Contraseña'), 'Secreta123')
        await user.type(formulario.getByLabelText('Código de tu app'), '123456')
        await user.click(
          formulario.getByRole('button', { name: 'Desactivar verificación en dos pasos' })
        )
        const enVuelo = await formulario.findByRole('button', { name: 'Desactivando...' })
        await user.click(enVuelo)

        expect(enVuelo).toBeDisabled()
        expect(twoFactorService.disableTwoFactor).toHaveBeenCalledTimes(1)
      })

      // 409 NOT_ENABLED: se desactivo en otra pestaña, la pantalla se corrige sola.
      it('si el backend dice que ya estaba desactivada (409) la pantalla vuelve a "activar"', async () => {
        vi.mocked(twoFactorService.disableTwoFactor).mockRejectedValue(
          errorApi('La verificación en dos pasos no está activada', 409, 'TWO_FACTOR_NOT_ENABLED')
        )
        const user = userEvent.setup()
        renderPagina()
        await esperarEstado()
        const formulario = seccion('Desactivar la verificación en dos pasos')

        await user.type(formulario.getByLabelText('Contraseña'), 'Secreta123')
        await user.type(formulario.getByLabelText('Código de tu app'), '123456')
        await user.click(
          formulario.getByRole('button', { name: 'Desactivar verificación en dos pasos' })
        )

        expect(
          await screen.findByRole('button', { name: 'Activar verificación en dos pasos' })
        ).toBeInTheDocument()
        expect(useAuthStore.getState().token).toBe('jwt-viejo')
      })
    })
  })
})
