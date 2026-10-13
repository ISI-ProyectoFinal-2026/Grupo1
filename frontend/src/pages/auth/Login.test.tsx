import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from '@/pages/auth/Login'
import * as authService from '@/services/auth.service'
import * as twoFactorService from '@/services/two-factor.service'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser, TwoFactorChallenge } from '@/types/auth'

vi.mock('@/services/auth.service')
vi.mock('@/services/two-factor.service')

const usuario: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: 'Franco Marin',
  phone: null,
  role: 'usuario_regular',
  emailVerifiedAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

function Sonda() {
  const location = useLocation()
  return <p data-testid="ubicacion">{`${location.pathname}${location.search}`}</p>
}

function renderLogin(
  state?: { registered?: boolean; emailVerified?: boolean; passwordReset?: boolean }
) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Sonda />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div>Feed de reportes</div>} />
        <Route path="/register" element={<div>Crear cuenta</div>} />
        <Route path="/forgot-password" element={<div>Recuperar contraseña</div>} />
      </Routes>
    </MemoryRouter>
  )
}

async function completarYEnviar(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), usuario.email)
  await user.type(screen.getByLabelText('Contraseña'), 'Secreta123')
  await user.click(screen.getByRole('button', { name: 'Ingresar' }))
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('renderiza los campos y el link a registro', () => {
    renderLogin()

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrate' })).toBeInTheDocument()
  })

  // El aviso viaja en el state de la navegacion que hace Register, no en la
  // URL: si se pierde, el usuario recien registrado no entiende por que
  // aterrizo en el login.
  it('avisa que la cuenta fue creada cuando viene del registro', () => {
    renderLogin({ registered: true })

    expect(screen.getByText('Cuenta creada. Te enviamos un email para verificarla, revisá tu casilla e iniciá sesión')).toBeInTheDocument()
  })

  it('no muestra el aviso en un ingreso normal', () => {
    renderLogin()

    expect(screen.queryByText('Cuenta creada. Te enviamos un email para verificarla, revisá tu casilla e iniciá sesión')).not.toBeInTheDocument()
  })

  it('ofrece recuperar la contraseña desde el login', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }))

    expect(await screen.findByText('Recuperar contraseña')).toBeInTheDocument()
  })

  // Cada aviso llega por el state de la navegacion de la pagina anterior
  // (verificar email, reset de contraseña): solo se muestra el que corresponde.
  it('avisa que el email quedo verificado cuando viene de /verify-email', () => {
    renderLogin({ emailVerified: true })

    expect(screen.getByText('Tu email quedó verificado, iniciá sesión')).toBeInTheDocument()
    expect(screen.queryByText('Tu contraseña se actualizó, iniciá sesión con la nueva')).toBeNull()
  })

  it('avisa que la contraseña se actualizo cuando viene de /reset-password', () => {
    renderLogin({ passwordReset: true })

    expect(
      screen.getByText('Tu contraseña se actualizó, iniciá sesión con la nueva')
    ).toBeInTheDocument()
    expect(screen.queryByText('Tu email quedó verificado, iniciá sesión')).toBeNull()
  })

  it('guarda la sesion y redirige al feed cuando el login es correcto', async () => {
    vi.mocked(authService.login).mockResolvedValue({ token: 'jwt-de-prueba', user: usuario })
    const user = userEvent.setup()
    renderLogin()

    await completarYEnviar(user)

    await waitFor(() =>
      expect(authService.login).toHaveBeenCalledWith({
        email: usuario.email,
        password: 'Secreta123',
      })
    )
    expect(await screen.findByText('Feed de reportes')).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBe('jwt-de-prueba')
    expect(useAuthStore.getState().user).toEqual(usuario)
  })

  it('muestra el mensaje del backend y no guarda sesion si falla', async () => {
    vi.mocked(authService.login).mockRejectedValue(new Error('Credenciales inválidas'))
    const user = userEvent.setup()
    renderLogin()

    await completarYEnviar(user)

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBeNull()
    expect(screen.queryByText('Feed de reportes')).not.toBeInTheDocument()
  })

  it('cae a un mensaje generico si el rechazo no es un Error', async () => {
    vi.mocked(authService.login).mockRejectedValue('caida de red')
    const user = userEvent.setup()
    renderLogin()

    await completarYEnviar(user)

    expect(await screen.findByText('Error inesperado, intentá de nuevo')).toBeInTheDocument()
  })

  // Sin el disabled, un doble click manda dos veces el login y el rate limit
  // del backend (5 por minuto en /api/auth) empieza a devolver 429.
  it('deshabilita el boton mientras la peticion esta en vuelo', async () => {
    let resolver: (valor: { token: string; user: AuthUser }) => void = () => {}
    vi.mocked(authService.login).mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve
      })
    )
    const user = userEvent.setup()
    renderLogin()

    await completarYEnviar(user)

    expect(await screen.findByRole('button', { name: 'Ingresando...' })).toBeDisabled()

    resolver({ token: 'jwt-de-prueba', user: usuario })
    await screen.findByText('Feed de reportes')
  })
})

const DESAFIO = 'desafio-secreto-de-prueba'

const desafio: TwoFactorChallenge = { twoFactorRequired: true, twoFactorToken: DESAFIO }

function errorApi(message: string, status: number, code: string, details?: unknown) {
  return Object.assign(new Error(message), { status, code, details })
}

async function llegarAlSegundoPaso(
  user: ReturnType<typeof userEvent.setup>,
  respuesta: TwoFactorChallenge = desafio
) {
  vi.mocked(authService.login).mockResolvedValue(respuesta)
  await completarYEnviar(user)
  await screen.findByRole('heading', { name: 'Verificación en dos pasos' })
}

describe('Login con verificación en dos pasos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('muestra el segundo paso y no guarda sesion mientras falta el codigo', async () => {
    const user = userEvent.setup()
    renderLogin()

    await llegarAlSegundoPaso(user)

    expect(screen.getByLabelText('Código de verificación')).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
    expect(screen.queryByText('Feed de reportes')).not.toBeInTheDocument()
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(twoFactorService.loginWithTwoFactor).not.toHaveBeenCalled()
  })

  it('con el codigo correcto guarda la sesion nueva y va al feed', async () => {
    vi.mocked(twoFactorService.loginWithTwoFactor).mockResolvedValue({
      token: 'jwt-final',
      user: { ...usuario, twoFactorEnabled: true },
    })
    const user = userEvent.setup()
    renderLogin()
    await llegarAlSegundoPaso(user)

    await user.type(screen.getByLabelText('Código de verificación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByText('Feed de reportes')).toBeInTheDocument()
    expect(twoFactorService.loginWithTwoFactor).toHaveBeenCalledWith({
      twoFactorToken: DESAFIO,
      code: '123456',
    })
    expect(useAuthStore.getState().token).toBe('jwt-final')
    expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(true)
  })

  it('saca los espacios de un codigo pegado con formato', async () => {
    vi.mocked(twoFactorService.loginWithTwoFactor).mockResolvedValue({
      token: 'jwt-final',
      user: usuario,
    })
    const user = userEvent.setup()
    renderLogin()
    await llegarAlSegundoPaso(user)

    await user.type(screen.getByLabelText('Código de verificación'), '123 456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    await screen.findByText('Feed de reportes')
    expect(twoFactorService.loginWithTwoFactor).toHaveBeenCalledWith({
      twoFactorToken: DESAFIO,
      code: '123456',
    })
  })

  it('permite pasar a un codigo de recuperacion y manda ese codigo', async () => {
    vi.mocked(twoFactorService.loginWithTwoFactor).mockResolvedValue({
      token: 'jwt-final',
      user: usuario,
    })
    const user = userEvent.setup()
    renderLogin()
    await llegarAlSegundoPaso(user)

    await user.click(screen.getByRole('button', { name: 'Usar un código de recuperación' }))
    expect(screen.queryByLabelText('Código de verificación')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Código de recuperación'), 'ABCDE-FGHIJ')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    await screen.findByText('Feed de reportes')
    expect(twoFactorService.loginWithTwoFactor).toHaveBeenCalledWith({
      twoFactorToken: DESAFIO,
      code: 'ABCDE-FGHIJ',
    })
  })

  it('el modo recuperacion se puede deshacer y vuelve al codigo de la app', async () => {
    const user = userEvent.setup()
    renderLogin()
    await llegarAlSegundoPaso(user)

    await user.click(screen.getByRole('button', { name: 'Usar un código de recuperación' }))
    await user.click(screen.getByRole('button', { name: 'Usar el código de mi app' }))

    expect(screen.getByLabelText('Código de verificación')).toBeInTheDocument()
    expect(screen.queryByLabelText('Código de recuperación')).not.toBeInTheDocument()
  })

  it('un codigo incorrecto muestra el error, se queda en el paso y deja reintentar', async () => {
    vi.mocked(twoFactorService.loginWithTwoFactor)
      .mockRejectedValueOnce(
        errorApi('El código es inválido o expiró', 400, 'INVALID_TWO_FACTOR_CODE')
      )
      .mockResolvedValueOnce({ token: 'jwt-final', user: usuario })
    const user = userEvent.setup()
    renderLogin()
    await llegarAlSegundoPaso(user)

    await user.type(screen.getByLabelText('Código de verificación'), '000000')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByText('El código es inválido o expiró')).toBeInTheDocument()
    expect(screen.getByLabelText('Código de verificación')).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBeNull()

    await user.clear(screen.getByLabelText('Código de verificación'))
    await user.type(screen.getByLabelText('Código de verificación'), '654321')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    await screen.findByText('Feed de reportes')
    expect(twoFactorService.loginWithTwoFactor).toHaveBeenLastCalledWith({
      twoFactorToken: DESAFIO,
      code: '654321',
    })
  })

  it('cambiar de modo borra el error del intento anterior', async () => {
    vi.mocked(twoFactorService.loginWithTwoFactor).mockRejectedValue(
      errorApi('El código es inválido o expiró', 400, 'INVALID_TWO_FACTOR_CODE')
    )
    const user = userEvent.setup()
    renderLogin()
    await llegarAlSegundoPaso(user)
    await user.type(screen.getByLabelText('Código de verificación'), '000000')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    await screen.findByText('El código es inválido o expiró')

    await user.click(screen.getByRole('button', { name: 'Usar un código de recuperación' }))

    expect(screen.queryByText('El código es inválido o expiró')).not.toBeInTheDocument()
  })

  it('con el bloqueo (429) sigue en el segundo paso, avisa cuanto esperar y conserva la salida', async () => {
    vi.mocked(twoFactorService.loginWithTwoFactor).mockRejectedValue(
      errorApi('Demasiados intentos fallidos', 429, 'TWO_FACTOR_LOCKED', {
        retryAfterSeconds: 900,
      })
    )
    const user = userEvent.setup()
    renderLogin()
    await llegarAlSegundoPaso(user)

    await user.type(screen.getByLabelText('Código de verificación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByText(/Probá de nuevo en 15 minutos/)).toBeInTheDocument()
    expect(screen.getByLabelText('Código de verificación')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Perdí el acceso a mi autenticador' })
    ).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('con un 429 sin tiempo de espera cae al mensaje del backend', async () => {
    vi.mocked(twoFactorService.loginWithTwoFactor).mockRejectedValue(
      errorApi('Demasiados intentos, esperá un rato', 429, 'TWO_FACTOR_LOCKED')
    )
    const user = userEvent.setup()
    renderLogin()
    await llegarAlSegundoPaso(user)

    await user.type(screen.getByLabelText('Código de verificación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByText('Demasiados intentos, esperá un rato')).toBeInTheDocument()
    expect(screen.getByLabelText('Código de verificación')).toBeInTheDocument()
  })

  it('si el desafio expiro vuelve al paso de la contraseña con un aviso', async () => {
    vi.mocked(twoFactorService.loginWithTwoFactor).mockRejectedValue(
      errorApi('La verificación expiró, iniciá sesión de nuevo', 400, 'TWO_FACTOR_CHALLENGE_INVALID')
    )
    const user = userEvent.setup()
    renderLogin()
    await llegarAlSegundoPaso(user)

    await user.type(screen.getByLabelText('Código de verificación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(
      await screen.findByText('La verificación expiró, iniciá sesión de nuevo')
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue(usuario.email)
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('deshabilita el boton mientras se verifica el codigo', async () => {
    let resolver: (valor: { token: string; user: AuthUser }) => void = () => {}
    vi.mocked(twoFactorService.loginWithTwoFactor).mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve
      })
    )
    const user = userEvent.setup()
    renderLogin()
    await llegarAlSegundoPaso(user)

    await user.type(screen.getByLabelText('Código de verificación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByRole('button', { name: 'Verificando...' })).toBeDisabled()

    resolver({ token: 'jwt-final', user: usuario })
    await screen.findByText('Feed de reportes')
  })

  it('permite volver al paso de la contraseña y descarta el desafio', async () => {
    const user = userEvent.setup()
    renderLogin()
    await llegarAlSegundoPaso(user)

    await user.click(screen.getByRole('button', { name: 'Volver al inicio de sesión' }))

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Código de verificación')).not.toBeInTheDocument()
  })

  it('avisa cuando se completa un reinicio pendiente y que un codigo valido lo cancela', async () => {
    const user = userEvent.setup()
    renderLogin()

    await llegarAlSegundoPaso(user, {
      ...desafio,
      resetEffectiveAt: '2026-10-20T12:00:00.000Z',
    })

    const aviso = screen.getByRole('status')
    expect(aviso).toHaveTextContent(/octubre de 2026/)
    expect(aviso).toHaveTextContent(/código válido/)
    expect(aviso).toHaveTextContent(/cancela/)
  })

  it('sin reinicio pendiente no muestra ningun aviso de fecha', async () => {
    const user = userEvent.setup()
    renderLogin()

    await llegarAlSegundoPaso(user)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // El desafio es una credencial a medias: solo vive en el state del componente.
  it('el desafio no queda en la URL ni en el storage del navegador', async () => {
    vi.mocked(twoFactorService.loginWithTwoFactor).mockRejectedValue(
      errorApi('El código es inválido o expiró', 400, 'INVALID_TWO_FACTOR_CODE')
    )
    const user = userEvent.setup()
    renderLogin()
    await llegarAlSegundoPaso(user)
    await user.type(screen.getByLabelText('Código de verificación'), '000000')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))
    await screen.findByText('El código es inválido o expiró')

    expect(screen.getByTestId('ubicacion')).toHaveTextContent(/^\/login$/)
    const guardado = [localStorage, sessionStorage].flatMap((storage) =>
      Object.keys(storage).map((clave) => `${clave}=${storage.getItem(clave)}`)
    )
    expect(guardado.join('\n')).not.toContain(DESAFIO)
  })

  it('un reinicio madurado entra con una sesion normal, sin pasar por el segundo paso', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      token: 'jwt-reinicio',
      user: { ...usuario, twoFactorEnabled: false },
    })
    const user = userEvent.setup()
    renderLogin()

    await completarYEnviar(user)

    expect(await screen.findByText('Feed de reportes')).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBe('jwt-reinicio')
    expect(twoFactorService.loginWithTwoFactor).not.toHaveBeenCalled()
  })
})

describe('Login: perdí el acceso a mi autenticador', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAuthStore.getState().logout()
  })

  async function abrirAccesoPerdido(user: ReturnType<typeof userEvent.setup>) {
    await llegarAlSegundoPaso(user)
    await user.click(screen.getByRole('button', { name: 'Perdí el acceso a mi autenticador' }))
    await screen.findByRole('heading', { name: 'Recuperar el acceso' })
  }

  it('pide la contraseña, manda el pedido con el desafio y confirma que salio el email', async () => {
    vi.mocked(twoFactorService.requestTwoFactorReset).mockResolvedValue({
      message: 'Te mandamos un email para confirmar el reinicio',
    })
    const user = userEvent.setup()
    renderLogin()
    await abrirAccesoPerdido(user)

    await user.type(screen.getByLabelText('Contraseña'), 'Secreta123')
    await user.click(screen.getByRole('button', { name: 'Enviar email de confirmación' }))

    expect(
      await screen.findByText('Te mandamos un email para confirmar el reinicio')
    ).toBeInTheDocument()
    expect(twoFactorService.requestTwoFactorReset).toHaveBeenCalledWith({
      twoFactorToken: DESAFIO,
      password: 'Secreta123',
    })
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('una contraseña incorrecta (403) se avisa en el lugar y no saca de la pantalla', async () => {
    vi.mocked(twoFactorService.requestTwoFactorReset).mockRejectedValue(
      errorApi('La contraseña es incorrecta', 403, 'INVALID_PASSWORD')
    )
    const user = userEvent.setup()
    renderLogin()
    await abrirAccesoPerdido(user)

    await user.type(screen.getByLabelText('Contraseña'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Enviar email de confirmación' }))

    expect(await screen.findByText('La contraseña es incorrecta')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recuperar el acceso' })).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
  })

  it('el pedido repetido (429) muestra el mensaje del backend en el lugar', async () => {
    vi.mocked(twoFactorService.requestTwoFactorReset).mockRejectedValue(
      errorApi('Esperá un minuto antes de pedir otro email', 429, 'TWO_FACTOR_RESET_COOLDOWN', {
        retryAfterSeconds: 40,
      })
    )
    const user = userEvent.setup()
    renderLogin()
    await abrirAccesoPerdido(user)

    await user.type(screen.getByLabelText('Contraseña'), 'Secreta123')
    await user.click(screen.getByRole('button', { name: 'Enviar email de confirmación' }))

    expect(
      await screen.findByText('Esperá un minuto antes de pedir otro email')
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recuperar el acceso' })).toBeInTheDocument()
  })

  it('despues de un error se puede volver al codigo con el mismo desafio', async () => {
    vi.mocked(twoFactorService.requestTwoFactorReset).mockRejectedValue(
      errorApi('La contraseña es incorrecta', 403, 'INVALID_PASSWORD')
    )
    vi.mocked(twoFactorService.loginWithTwoFactor).mockResolvedValue({
      token: 'jwt-final',
      user: usuario,
    })
    const user = userEvent.setup()
    renderLogin()
    await abrirAccesoPerdido(user)
    await user.type(screen.getByLabelText('Contraseña'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Enviar email de confirmación' }))
    await screen.findByText('La contraseña es incorrecta')

    await user.click(screen.getByRole('button', { name: 'Volver a ingresar el código' }))
    await user.type(screen.getByLabelText('Código de verificación'), '123456')
    await user.click(screen.getByRole('button', { name: 'Verificar' }))

    await screen.findByText('Feed de reportes')
    expect(twoFactorService.loginWithTwoFactor).toHaveBeenCalledWith({
      twoFactorToken: DESAFIO,
      code: '123456',
    })
  })

  it('si el desafio ya no vale vuelve al paso de la contraseña con un aviso', async () => {
    vi.mocked(twoFactorService.requestTwoFactorReset).mockRejectedValue(
      errorApi('La verificación expiró, iniciá sesión de nuevo', 400, 'TWO_FACTOR_CHALLENGE_INVALID')
    )
    const user = userEvent.setup()
    renderLogin()
    await abrirAccesoPerdido(user)

    await user.type(screen.getByLabelText('Contraseña'), 'Secreta123')
    await user.click(screen.getByRole('button', { name: 'Enviar email de confirmación' }))

    expect(
      await screen.findByText('La verificación expiró, iniciá sesión de nuevo')
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('tambien se ofrece cuando el desafio trae un reinicio pendiente', async () => {
    const user = userEvent.setup()
    renderLogin()

    await llegarAlSegundoPaso(user, { ...desafio, resetEffectiveAt: '2026-10-20T12:00:00.000Z' })

    expect(
      screen.getByRole('button', { name: 'Perdí el acceso a mi autenticador' })
    ).toBeInTheDocument()
  })
})
