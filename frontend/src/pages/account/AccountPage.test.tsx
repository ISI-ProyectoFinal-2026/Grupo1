import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AccountPage from '@/pages/account/AccountPage'
import * as authService from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/auth.service')

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

function errorApi(message: string, status: number, code?: string, details?: unknown) {
  return Object.assign(new Error(message), { status, code, details })
}

// muestra el aviso que recibe /login por el state
function SondaLogin() {
  const state = useLocation().state as { accountDeleted?: boolean } | null
  return <div>{state?.accountDeleted ? 'pagina login con aviso de baja' : 'pagina login'}</div>
}

function renderPagina() {
  const { Wrapper, client } = createQueryWrapper()
  render(
    <Wrapper>
      <MemoryRouter initialEntries={['/account/profile']}>
        <Routes>
          <Route path='/account/profile' element={<AccountPage />} />
          <Route path='/login' element={<SondaLogin />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
  return client
}

function seccion(nombre: string) {
  return within(screen.getByRole('region', { name: nombre }))
}

async function abrirBaja(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }))
  return within(screen.getByRole('alertdialog', { name: '¿Eliminar tu cuenta?' }))
}

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authService.getMe).mockReturnValue(new Promise(() => {}))
    useAuthStore.setState({ token: 'token', user: usuario })
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
    vi.unstubAllGlobals()
  })

  describe('datos personales', () => {
    it('precarga el nombre y el teléfono del usuario', () => {
      useAuthStore.setState({ token: 'token', user: { ...usuario, phone: '11 5555-5555' } })

      renderPagina()

      expect(screen.getByRole('heading', { level: 1, name: 'Mi cuenta' })).toBeInTheDocument()
      expect(seccion('Datos personales').getByLabelText('Nombre')).toHaveValue('Franco')
      expect(seccion('Datos personales').getByLabelText(/Teléfono/)).toHaveValue('11 5555-5555')
    })

    it('guarda nombre y teléfono y actualiza el usuario del store', async () => {
      const actualizado = { ...usuario, fullName: 'Franco Marin', phone: '+54 9 351 555-5555' }
      vi.mocked(authService.updateProfile).mockResolvedValue(actualizado)
      const user = userEvent.setup()
      renderPagina()

      const datos = seccion('Datos personales')
      await user.clear(datos.getByLabelText('Nombre'))
      await user.type(datos.getByLabelText('Nombre'), '  Franco Marin ')
      await user.type(datos.getByLabelText(/Teléfono/), '+54 9 351 555-5555')
      await user.click(datos.getByRole('button', { name: 'Guardar cambios' }))

      expect(await datos.findByRole('status')).toHaveTextContent('Guardamos tus datos')
      expect(authService.updateProfile).toHaveBeenCalledWith({
        fullName: 'Franco Marin',
        phone: '+54 9 351 555-5555',
      })
      expect(useAuthStore.getState().user?.phone).toBe('+54 9 351 555-5555')
    })

    it('manda null para borrar el nombre y el teléfono', async () => {
      useAuthStore.setState({ token: 'token', user: { ...usuario, phone: '11 5555-5555' } })
      vi.mocked(authService.updateProfile).mockResolvedValue({ ...usuario, fullName: null })
      const user = userEvent.setup()
      renderPagina()

      const datos = seccion('Datos personales')
      await user.clear(datos.getByLabelText('Nombre'))
      await user.clear(datos.getByLabelText(/Teléfono/))
      await user.click(datos.getByRole('button', { name: 'Guardar cambios' }))

      await waitFor(() =>
        expect(authService.updateProfile).toHaveBeenCalledWith({ fullName: null, phone: null })
      )
    })

    it('no manda un teléfono inválido y explica el formato', async () => {
      const user = userEvent.setup()
      renderPagina()

      const datos = seccion('Datos personales')
      const telefono = datos.getByLabelText(/Teléfono/)
      await user.type(telefono, '1234')
      await user.click(datos.getByRole('button', { name: 'Guardar cambios' }))

      expect(
        await datos.findByText('El teléfono debe tener entre 8 y 15 dígitos')
      ).toBeInTheDocument()
      expect(telefono).toHaveAttribute('aria-invalid', 'true')
      expect(telefono).toHaveAccessibleDescription(/El teléfono debe tener entre 8 y 15 dígitos/)
      expect(authService.updateProfile).not.toHaveBeenCalled()
    })

    it('muestra el error del servidor', async () => {
      vi.mocked(authService.updateProfile).mockRejectedValue(errorApi('Datos inválidos', 400))
      const user = userEvent.setup()
      renderPagina()

      await user.click(seccion('Datos personales').getByRole('button', { name: 'Guardar cambios' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Datos inválidos')
    })

    it('explica el límite de intentos', async () => {
      vi.mocked(authService.updateProfile).mockRejectedValue(
        errorApi('Demasiados intentos, esperá unos minutos', 429)
      )
      const user = userEvent.setup()
      renderPagina()

      await user.click(seccion('Datos personales').getByRole('button', { name: 'Guardar cambios' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Hiciste demasiados cambios seguidos. Esperá unos minutos y probá de nuevo.'
      )
    })
  })

  describe('descarga de datos', () => {
    it('descarga el JSON con el nombre del archivo', async () => {
      const archivo = new Blob(['{"cuenta":{}}'], { type: 'application/json' })
      vi.mocked(authService.exportAccount).mockResolvedValue(archivo)
      const createObjectURL = vi.fn((_blob: Blob) => 'blob:mis-datos')
      const revokeObjectURL = vi.fn()
      vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      const user = userEvent.setup()
      renderPagina()

      await user.click(seccion('Tus datos').getByRole('button', { name: 'Descargar mis datos' }))

      await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
      expect(createObjectURL).toHaveBeenCalledWith(archivo)
      const enlace = click.mock.contexts[0] as HTMLAnchorElement
      expect(enlace.download).toBe('patitas-mis-datos.json')
      expect(enlace.href).toBe('blob:mis-datos')
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mis-datos')
      click.mockRestore()
    })

    it('explica el límite de descargas por hora', async () => {
      vi.mocked(authService.exportAccount).mockRejectedValue(errorApi('Error inesperado', 429))
      const user = userEvent.setup()
      renderPagina()

      await user.click(seccion('Tus datos').getByRole('button', { name: 'Descargar mis datos' }))

      expect(await seccion('Tus datos').findByRole('alert')).toHaveTextContent(
        'Ya descargaste tus datos varias veces en la última hora. Probá de nuevo más tarde.'
      )
    })

    it('avisa si la descarga falla por otro motivo', async () => {
      vi.mocked(authService.exportAccount).mockRejectedValue(errorApi('Error inesperado', 500))
      const user = userEvent.setup()
      renderPagina()

      await user.click(seccion('Tus datos').getByRole('button', { name: 'Descargar mis datos' }))

      expect(await seccion('Tus datos').findByRole('alert')).toHaveTextContent(
        'No pudimos descargar tus datos. Probá de nuevo.'
      )
    })
  })

  describe('baja de la cuenta', () => {
    it('sin 2FA pide solo la contraseña, cierra la sesión y lleva al login', async () => {
      vi.mocked(authService.deleteAccount).mockResolvedValue(undefined)
      const user = userEvent.setup()
      const client = renderPagina()
      client.setQueryData(['auth', 'me'], usuario)

      const dialogo = await abrirBaja(user)
      expect(dialogo.queryByLabelText(/Código/)).not.toBeInTheDocument()
      await user.type(dialogo.getByLabelText('Contraseña'), 'secreta123')
      await user.click(dialogo.getByRole('button', { name: 'Eliminar definitivamente' }))

      expect(await screen.findByText('pagina login con aviso de baja')).toBeInTheDocument()
      expect(authService.deleteAccount).toHaveBeenCalledWith({ password: 'secreta123' })
      expect(useAuthStore.getState().token).toBeNull()
      expect(useAuthStore.getState().user).toBeNull()
      expect(client.getQueryData(['auth', 'me'])).toBeUndefined()
    })

    it('con 2FA pide la contraseña y el código', async () => {
      useAuthStore.setState({ token: 'token', user: usuarioConDosPasos })
      vi.mocked(authService.deleteAccount).mockResolvedValue(undefined)
      const user = userEvent.setup()
      renderPagina()

      const dialogo = await abrirBaja(user)
      await user.type(dialogo.getByLabelText('Contraseña'), 'secreta123')
      await user.type(dialogo.getByLabelText('Código de tu app'), '123 456')
      await user.click(dialogo.getByRole('button', { name: 'Eliminar definitivamente' }))

      expect(await screen.findByText('pagina login con aviso de baja')).toBeInTheDocument()
      expect(authService.deleteAccount).toHaveBeenCalledWith({
        password: 'secreta123',
        code: '123456',
      })
    })

    it('con 2FA acepta un código de recuperación', async () => {
      useAuthStore.setState({ token: 'token', user: usuarioConDosPasos })
      vi.mocked(authService.deleteAccount).mockResolvedValue(undefined)
      const user = userEvent.setup()
      renderPagina()

      const dialogo = await abrirBaja(user)
      await user.type(dialogo.getByLabelText('Contraseña'), 'secreta123')
      await user.click(dialogo.getByRole('button', { name: 'Usar un código de recuperación' }))
      await user.type(dialogo.getByLabelText('Código de recuperación'), ' AAAAA-BBBBB ')
      await user.click(dialogo.getByRole('button', { name: 'Eliminar definitivamente' }))

      await waitFor(() =>
        expect(authService.deleteAccount).toHaveBeenCalledWith({
          password: 'secreta123',
          code: 'AAAAA-BBBBB',
        })
      )
    })

    it('si el servidor pide el código, muestra el campo aunque el store no supiera del 2FA', async () => {
      useAuthStore.setState({ token: 'token', user: { ...usuario, twoFactorEnabled: undefined } })
      vi.mocked(authService.deleteAccount).mockRejectedValue(
        errorApi('Ingresá el código de tu app de autenticación', 400, 'TWO_FACTOR_CODE_REQUIRED')
      )
      const user = userEvent.setup()
      renderPagina()

      const dialogo = await abrirBaja(user)
      await user.type(dialogo.getByLabelText('Contraseña'), 'secreta123')
      await user.click(dialogo.getByRole('button', { name: 'Eliminar definitivamente' }))

      expect(await dialogo.findByRole('alert')).toHaveTextContent(
        'Tu cuenta tiene la verificación en dos pasos activa: ingresá un código de tu app o uno de recuperación.'
      )
      expect(dialogo.getByLabelText('Código de tu app')).toBeInTheDocument()
      expect(useAuthStore.getState().token).toBe('token')
    })

    it.each([
      ['INVALID_PASSWORD', 403, 'La contraseña es incorrecta.'],
      ['INVALID_TWO_FACTOR_CODE', 400, 'El código es incorrecto o ya venció. Probá con uno nuevo.'],
      [
        'ACCOUNT_SANCTION_OPEN',
        409,
        'No podés eliminar tu cuenta mientras tengas una sanción vigente o en revisión.',
      ],
      [
        'LAST_ADMIN',
        409,
        'Sos el único administrador activo. Asigná el rol a otra persona antes de eliminar tu cuenta.',
      ],
      [
        'ACTIVE_PREMIUM_BUSINESS',
        409,
        'Tu comercio tiene el plan Premium vigente. Vas a poder eliminar tu cuenta cuando venza.',
      ],
    ])('ante %s muestra un mensaje claro y no cierra la sesión', async (code, status, mensaje) => {
      useAuthStore.setState({ token: 'token', user: usuarioConDosPasos })
      vi.mocked(authService.deleteAccount).mockRejectedValue(
        errorApi('texto del backend', status, code)
      )
      const user = userEvent.setup()
      renderPagina()

      const dialogo = await abrirBaja(user)
      await user.type(dialogo.getByLabelText('Contraseña'), 'secreta123')
      await user.type(dialogo.getByLabelText('Código de tu app'), '123456')
      await user.click(dialogo.getByRole('button', { name: 'Eliminar definitivamente' }))

      expect(await dialogo.findByRole('alert')).toHaveTextContent(mensaje)
      expect(useAuthStore.getState().token).toBe('token')
      expect(screen.queryByText('pagina login')).not.toBeInTheDocument()
    })

    it('explica el bloqueo del segundo factor con la espera', async () => {
      useAuthStore.setState({ token: 'token', user: usuarioConDosPasos })
      vi.mocked(authService.deleteAccount).mockRejectedValue(
        errorApi('Demasiados intentos', 429, 'TWO_FACTOR_LOCKED', { retryAfterSeconds: 600 })
      )
      const user = userEvent.setup()
      renderPagina()

      const dialogo = await abrirBaja(user)
      await user.type(dialogo.getByLabelText('Contraseña'), 'secreta123')
      await user.type(dialogo.getByLabelText('Código de tu app'), '123456')
      await user.click(dialogo.getByRole('button', { name: 'Eliminar definitivamente' }))

      expect(await dialogo.findByRole('alert')).toHaveTextContent(
        'Demasiados intentos fallidos. Probá de nuevo en 10 minutos'
      )
    })

    it('explica el límite de intentos por IP', async () => {
      vi.mocked(authService.deleteAccount).mockRejectedValue(
        errorApi('Demasiados intentos, esperá unos minutos', 429)
      )
      const user = userEvent.setup()
      renderPagina()

      const dialogo = await abrirBaja(user)
      await user.type(dialogo.getByLabelText('Contraseña'), 'secreta123')
      await user.click(dialogo.getByRole('button', { name: 'Eliminar definitivamente' }))

      expect(await dialogo.findByRole('alert')).toHaveTextContent(
        'Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.'
      )
    })

    it('el diálogo toma el foco, se cancela con Escape y lo devuelve al botón', async () => {
      const user = userEvent.setup()
      renderPagina()

      const boton = screen.getByRole('button', { name: 'Eliminar mi cuenta' })
      await user.click(boton)
      const dialogo = screen.getByRole('alertdialog', { name: '¿Eliminar tu cuenta?' })
      expect(dialogo).toHaveAttribute('aria-modal', 'true')
      expect(dialogo).toHaveFocus()

      await user.keyboard('{Escape}')

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(boton).toHaveFocus()
      expect(authService.deleteAccount).not.toHaveBeenCalled()
    })

    it('Cancelar cierra el diálogo sin eliminar', async () => {
      const user = userEvent.setup()
      renderPagina()

      const dialogo = await abrirBaja(user)
      await user.click(dialogo.getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(authService.deleteAccount).not.toHaveBeenCalled()
    })
  })
})
