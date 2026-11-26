import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MainLayout from '@/layouts/MainLayout'
import { createQueryWrapper } from '@/test/query-wrapper'
import { useAuthStore } from '@/stores/auth.store'
import * as notificationsService from '@/services/notifications.service'
import * as authService from '@/services/auth.service'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/notifications.service')
vi.mock('@/services/auth.service')

const usuario: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: 'Franco',
  phone: null,
  role: 'usuario_regular',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function renderLayout(ruta = '/') {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={[ruta]}>
        <MainLayout />
      </MemoryRouter>
    </Wrapper>
  )
}

describe('MainLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(notificationsService.listNotifications).mockResolvedValue([])
    vi.mocked(authService.getMe).mockResolvedValue(usuario)
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('muestra el bell de notificaciones con sesion iniciada', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })

    renderLayout()

    expect(await screen.findByRole('button', { name: 'Notificaciones' })).toBeInTheDocument()
  })

  it('muestra el boton de ayuda de su rol con sesion iniciada', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })

    renderLayout()

    expect(await screen.findByRole('button', { name: 'Ayuda' })).toBeInTheDocument()
  })

  it.each(['/reports/5', '/reports/mine', '/chats/3', '/'])('en %s el boton de ayuda nunca se oculta', async (ruta) => {
    useAuthStore.setState({ token: 'token', user: usuario })

    renderLayout(ruta)

    const contenedor = (await screen.findByRole('button', { name: 'Ayuda' })).parentElement
    expect(contenedor).not.toHaveClass('max-lg:hidden')
  })

  it('el boton de ayuda toma la seccion de la ruta', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })

    renderLayout('/businesses')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Ayuda' }))

    expect(screen.getByRole('dialog', { name: 'Ayuda: Comercios (Usuario)' })).toBeInTheDocument()
  })

  it('no muestra el boton de ayuda sin sesion', async () => {
    useAuthStore.setState({ token: null, user: null })

    renderLayout()

    await waitFor(() => expect(screen.getByText('PATITAS')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Ayuda' })).not.toBeInTheDocument()
  })

  it('no muestra el bell sin sesion', async () => {
    useAuthStore.setState({ token: null, user: null })

    renderLayout()

    await waitFor(() => expect(screen.getByText('PATITAS')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Notificaciones' })).not.toBeInTheDocument()
    expect(notificationsService.listNotifications).not.toHaveBeenCalled()
  })

  // un visitante que llega a un reporte publico tiene por donde entrar (#187)
  it('sin sesion ofrece ingresar y crear cuenta, sin la navegacion de la cuenta', async () => {
    useAuthStore.setState({ token: null, user: null })

    renderLayout('/reports/5')

    expect(await screen.findByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/register')
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument()
    expect(authService.getMe).not.toHaveBeenCalled()
  })

  // el login vuelve a la pagina publica desde la que se entro (#187)
  it('Ingresar lleva al login recordando la pagina publica', async () => {
    useAuthStore.setState({ token: null, user: null })
    function SondaLogin() {
      return <p data-testid='state-login'>{JSON.stringify(useLocation().state)}</p>
    }
    const { Wrapper } = createQueryWrapper()
    render(
      <Wrapper>
        <MemoryRouter initialEntries={['/reports/5?vista=mapa#flyer']}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path='/reports/:id' element={<div>detalle</div>} />
              <Route path='/login' element={<SondaLogin />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>
    )

    await userEvent.setup().click(await screen.findByRole('link', { name: 'Ingresar' }))

    expect(JSON.parse(screen.getByTestId('state-login').textContent ?? 'null')).toEqual({
      from: { pathname: '/reports/5', search: '?vista=mapa', hash: '#flyer' },
    })
  })

  // volver a un link de email (token de un solo uso) despues del login no sirve
  it('desde una pagina de link de email Ingresar no guarda el origen', async () => {
    useAuthStore.setState({ token: null, user: null })
    function SondaLogin() {
      return <p data-testid='state-login'>{JSON.stringify(useLocation().state)}</p>
    }
    const { Wrapper } = createQueryWrapper()
    render(
      <Wrapper>
        <MemoryRouter initialEntries={['/verify-email?token=abc']}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path='/verify-email' element={<div>verificar</div>} />
              <Route path='/login' element={<SondaLogin />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>
    )

    await userEvent.setup().click(await screen.findByRole('link', { name: 'Ingresar' }))

    expect(screen.getByTestId('state-login')).toHaveTextContent('null')
  })

  it.each(['/login', '/register'])('en %s no repite los accesos de invitado', async (ruta) => {
    useAuthStore.setState({ token: null, user: null })

    renderLayout(ruta)

    await waitFor(() => expect(screen.getByText('PATITAS')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Ingresar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Crear cuenta' })).not.toBeInTheDocument()
  })

  it('con sesion no muestra los accesos de invitado', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })

    renderLayout('/reports')

    await screen.findByRole('button', { name: 'Notificaciones' })
    expect(screen.queryByRole('link', { name: 'Ingresar' })).not.toBeInTheDocument()
  })

  it('ofrece el panel de moderacion a un moderador', async () => {
    useAuthStore.setState({ token: 'token', user: { ...usuario, role: 'moderador' } })

    renderLayout()

    expect(await screen.findByRole('link', { name: 'Moderación' })).toHaveAttribute(
      'href',
      '/moderation'
    )
  })

  it('ofrece la administracion de usuarios a un admin', async () => {
    useAuthStore.setState({ token: 'token', user: { ...usuario, role: 'admin' } })

    renderLayout()

    expect(await screen.findByRole('link', { name: 'Administración' })).toHaveAttribute(
      'href',
      '/admin/users'
    )
  })

  it('marca Administración como activa en su ruta', async () => {
    useAuthStore.setState({ token: 'token', user: { ...usuario, role: 'admin' } })
    vi.mocked(authService.getMe).mockReturnValue(new Promise(() => {}))

    renderLayout('/admin/users')

    expect(await screen.findByRole('link', { name: 'Administración' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it.each(['admin', 'moderador'] as const)(
    'ofrece la cola de sanciones al rol %s y la marca activa en su ruta',
    async (role) => {
      useAuthStore.setState({ token: 'token', user: { ...usuario, role } })

      renderLayout('/admin/sanctions')

      const enlace = await screen.findByRole('link', { name: 'Sanciones' })
      expect(enlace).toHaveAttribute('href', '/admin/sanctions')
      expect(enlace).toHaveAttribute('aria-current', 'page')
    }
  )

  it('oculta la cola de sanciones a un usuario regular', async () => {
    useAuthStore.setState({ token: 'token', user: { ...usuario, role: 'usuario_regular' } })

    renderLayout()

    await waitFor(() => expect(screen.getByText('PATITAS')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Sanciones' })).not.toBeInTheDocument()
  })

  it.each(['moderador', 'usuario_regular'] as const)(
    'oculta la administracion al rol %s',
    async (role) => {
      useAuthStore.setState({ token: 'token', user: { ...usuario, role } })

      renderLayout()

      await waitFor(() => expect(screen.getByText('PATITAS')).toBeInTheDocument())
      expect(screen.getByRole('link', { name: 'Mis mascotas' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Administración' })).not.toBeInTheDocument()
    }
  )

  it('ofrece el acceso a mis mascotas con sesion', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })

    renderLayout()

    expect(await screen.findByRole('link', { name: 'Mis mascotas' })).toHaveAttribute(
      'href',
      '/pets'
    )
  })

  it.each(['/pets', '/pets/new', '/pets/3/edit'])(
    'marca mis mascotas como pagina actual en %s',
    async (ruta) => {
      useAuthStore.setState({ token: 'token', user: usuario })
      vi.mocked(authService.getMe).mockReturnValue(new Promise(() => {}))
      const { Wrapper } = createQueryWrapper()

      render(
        <Wrapper>
          <MemoryRouter initialEntries={[ruta]}>
            <MainLayout />
          </MemoryRouter>
        </Wrapper>
      )

      expect(await screen.findByRole('link', { name: 'Mis mascotas' })).toHaveAttribute(
        'aria-current',
        'page'
      )
    }
  )

  it('ofrece el acceso a mis reportes con sesion', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })

    renderLayout()

    expect(await screen.findByRole('link', { name: 'Mis reportes' })).toHaveAttribute(
      'href',
      '/reports/mine'
    )
  })

  it('en /reports/mine marca mis reportes y no la pestaña Reportes', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })
    vi.mocked(authService.getMe).mockReturnValue(new Promise(() => {}))
    const { Wrapper } = createQueryWrapper()

    render(
      <Wrapper>
        <MemoryRouter initialEntries={['/reports/mine']}>
          <MainLayout />
        </MemoryRouter>
      </Wrapper>
    )

    expect(await screen.findByRole('link', { name: 'Mis reportes' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    for (const link of screen.getAllByRole('link', { name: 'Reportes' })) {
      expect(link).not.toHaveAttribute('aria-current')
    }
  })

  it('no ofrece el panel de moderacion a un usuario regular', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })

    renderLayout()

    await waitFor(() => expect(screen.getByText('PATITAS')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Moderación' })).not.toBeInTheDocument()
  })

  // /me no se resuelve a proposito: si respondiera despues del afterEach, su
  // setUser pisaria el store del test siguiente.
  it('el email del usuario lleva a la pagina de seguridad de la cuenta', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })
    vi.mocked(authService.getMe).mockReturnValue(new Promise(() => {}))

    renderLayout()

    const enlace = await screen.findByRole('link', { name: /franco@patitas\.test/ })
    expect(enlace).toHaveAttribute('href', '/account/security')
    expect(enlace).toHaveAccessibleName('Seguridad de la cuenta: franco@patitas.test')
    expect(enlace).toHaveTextContent('franco@patitas.test')
  })

  it('ofrece el acceso a las notificaciones arriba del email', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })
    vi.mocked(authService.getMe).mockReturnValue(new Promise(() => {}))

    renderLayout()

    const enlace = await screen.findByRole('link', { name: 'Notificaciones' })
    expect(enlace).toHaveAttribute('href', '/account/notifications')
    const email = screen.getByRole('link', { name: /franco@patitas.test/ })
    expect(enlace.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(enlace).not.toHaveAttribute('aria-current')
  })

  it('ofrece Mi cuenta arriba de las notificaciones', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })
    vi.mocked(authService.getMe).mockReturnValue(new Promise(() => {}))

    renderLayout()

    const enlace = await screen.findByRole('link', { name: 'Mi cuenta' })
    expect(enlace).toHaveAttribute('href', '/account/profile')
    const notificaciones = screen.getByRole('link', { name: 'Notificaciones' })
    expect(enlace.compareDocumentPosition(notificaciones) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(enlace).not.toHaveAttribute('aria-current')
  })

  it('marca Mi cuenta como activa en su ruta', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })
    vi.mocked(authService.getMe).mockReturnValue(new Promise(() => {}))

    renderLayout('/account/profile')

    expect(await screen.findByRole('link', { name: 'Mi cuenta' })).toHaveAttribute('aria-current', 'page')
  })

  it('marca Notificaciones como activa en su ruta', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })
    vi.mocked(authService.getMe).mockReturnValue(new Promise(() => {}))

    renderLayout('/account/notifications')

    expect(await screen.findByRole('link', { name: 'Notificaciones' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('en la página del plan Premium marca Mi comercio y no Comercios', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })
    vi.mocked(authService.getMe).mockReturnValue(new Promise(() => {}))

    renderLayout('/businesses/plan')

    expect(await screen.findByRole('link', { name: 'Mi comercio' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Comercios' })).not.toHaveAttribute('aria-current')
  })

  it('sin sesion no hay enlace a las notificaciones', async () => {
    renderLayout()

    await waitFor(() => expect(screen.getByText('PATITAS')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Notificaciones' })).not.toBeInTheDocument()
  })

  it('muestra el email del usuario que esta logueado, no uno fijo', async () => {
    useAuthStore.setState({ token: 'token', user: { ...usuario, email: 'ana@patitas.test' } })
    vi.mocked(authService.getMe).mockReturnValue(new Promise(() => {}))

    renderLayout()

    expect(await screen.findByRole('link', { name: /ana@patitas\.test/ })).toHaveAttribute(
      'href',
      '/account/security'
    )
    expect(screen.queryByRole('link', { name: /franco@patitas\.test/ })).not.toBeInTheDocument()
  })

  it('sin sesion no hay enlace a la pagina de seguridad', async () => {
    renderLayout()

    await waitFor(() => expect(screen.getByText('PATITAS')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /seguridad de la cuenta/i })).not.toBeInTheDocument()
  })

  it('limpia el cache de queries al cerrar sesion (navegador compartido, #175)', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })
    const { Wrapper, client } = createQueryWrapper()
    const clearSpy = vi.spyOn(client, 'clear')

    render(
      <Wrapper>
        <MemoryRouter>
          <MainLayout />
        </MemoryRouter>
      </Wrapper>
    )

    await userEvent.setup().click(await screen.findByRole('button', { name: /cerrar sesión/i }))

    expect(clearSpy).toHaveBeenCalled()
  })

  it('revoca el JWT en el backend antes de limpiar la sesion local', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })
    renderLayout()

    await userEvent.setup().click(await screen.findByRole('button', { name: /cerrar sesión/i }))

    expect(authService.logout).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull())
  })

  it('cierra la sesion local aunque falle el logout del backend', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })
    vi.mocked(authService.logout).mockRejectedValue(new Error('network'))
    const { Wrapper, client } = createQueryWrapper()
    const clearSpy = vi.spyOn(client, 'clear')

    render(
      <Wrapper>
        <MemoryRouter>
          <MainLayout />
        </MemoryRouter>
      </Wrapper>
    )

    await userEvent.setup().click(await screen.findByRole('button', { name: /cerrar sesión/i }))

    await waitFor(() => expect(useAuthStore.getState().token).toBeNull())
    expect(clearSpy).toHaveBeenCalled()
  })

  // Cubre al usuario que verificó desde otro dispositivo: el store persistido
  // dice "sin verificar" hasta que /me lo corrige al abrir la app.
  it('refresca el usuario contra /auth/me al montar con sesion', async () => {
    useAuthStore.setState({ token: 'token', user: { ...usuario, emailVerifiedAt: null } })

    renderLayout()

    await waitFor(() =>
      expect(useAuthStore.getState().user?.emailVerifiedAt).toBe('2026-01-01T00:00:00.000Z')
    )
    expect(authService.getMe).toHaveBeenCalledTimes(1)
  })

  it('no consulta /auth/me sin sesion', async () => {
    renderLayout()

    await waitFor(() => expect(screen.getByText('PATITAS')).toBeInTheDocument())
    expect(authService.getMe).not.toHaveBeenCalled()
  })

  it('muestra el banner de verificacion a un usuario sin verificar', async () => {
    useAuthStore.setState({ token: 'token', user: { ...usuario, emailVerifiedAt: null } })
    vi.mocked(authService.getMe).mockResolvedValue({ ...usuario, emailVerifiedAt: null })

    renderLayout()

    expect(
      await screen.findByRole('region', { name: 'Verificación de email' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reenviar email de verificación' })).toBeEnabled()
  })

  // Verificó desde otro dispositivo: /me corrige el store y el banner se va solo.
  it('esconde el banner cuando /auth/me confirma que ya esta verificado', async () => {
    useAuthStore.setState({ token: 'token', user: { ...usuario, emailVerifiedAt: null } })
    let resolverMe: (user: AuthUser) => void = () => {}
    vi.mocked(authService.getMe).mockReturnValue(
      new Promise((resolve) => {
        resolverMe = resolve
      })
    )

    renderLayout()
    expect(screen.getByRole('region', { name: 'Verificación de email' })).toBeInTheDocument()

    resolverMe({ ...usuario, emailVerifiedAt: '2026-01-01T00:00:00.000Z' })

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Verificación de email' })).not.toBeInTheDocument()
    )
    expect(useAuthStore.getState().user?.emailVerifiedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('no muestra el banner a un usuario verificado', async () => {
    useAuthStore.setState({ token: 'token', user: usuario })

    renderLayout()

    await waitFor(() => expect(screen.getByText('PATITAS')).toBeInTheDocument())
    expect(screen.queryByRole('region', { name: 'Verificación de email' })).not.toBeInTheDocument()
  })

  it('no muestra el banner sin sesion', async () => {
    renderLayout()

    await waitFor(() => expect(screen.getByText('PATITAS')).toBeInTheDocument())
    expect(screen.queryByRole('region', { name: 'Verificación de email' })).not.toBeInTheDocument()
  })
})
