import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { router } from '@/router'
import { useAuthStore } from '@/stores/auth.store'

// Las paginas y el layout se reemplazan por marcadores: aca solo se prueba la
// tabla de rutas, no el contenido de cada pantalla.
vi.mock('@/layouts/MainLayout', () => ({
  default: () => (
    <div>
      <Outlet />
    </div>
  ),
}))
vi.mock('@/pages/Home', () => ({ default: () => <div>pagina home</div> }))
vi.mock('@/pages/auth/Login', () => ({ default: () => <div>pagina login</div> }))
vi.mock('@/pages/auth/Register', () => ({ default: () => <div>pagina registro</div> }))
vi.mock('@/pages/reports/FeedPage', () => ({ default: () => <div>pagina feed</div> }))
vi.mock('@/pages/reports/CreateReportPage', () => ({ default: () => <div>pagina crear reporte</div> }))
vi.mock('@/pages/reports/ReportDetailPage', () => ({ default: () => <div>pagina detalle reporte</div> }))
vi.mock('@/pages/chat/ChatPage', () => ({ default: () => <div>pagina chat</div> }))
vi.mock('@/pages/business/BusinessRegisterPage', () => ({
  default: () => <div>pagina alta comercio</div>,
}))
vi.mock('@/pages/business/BusinessDashboardPage', () => ({
  default: () => <div>pagina panel comercio</div>,
}))
vi.mock('@/pages/business/BusinessDirectoryPage', () => ({
  default: () => <div>pagina directorio comercios</div>,
}))
vi.mock('@/pages/business/BusinessProfilePage', () => ({
  default: () => <div>pagina perfil comercio</div>,
}))

const usuario = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

function renderRuta(ruta: string) {
  const memoria = createMemoryRouter(router.routes, { initialEntries: [ruta] })
  render(<RouterProvider router={memoria} />)
  return memoria
}

afterEach(() => {
  useAuthStore.getState().logout()
})

describe('router: rutas publicas', () => {
  it.each([
    ['/login', 'pagina login'],
    ['/register', 'pagina registro'],
  ])('%s se renderiza sin sesion', (ruta, texto) => {
    renderRuta(ruta)

    expect(screen.getByText(texto)).toBeInTheDocument()
  })
})

describe('router: rutas protegidas', () => {
  const protegidas = [
    '/',
    '/reports',
    '/reports/new',
    '/reports/5',
    '/chats',
    '/chats/3',
    '/businesses',
    '/businesses/register',
    '/businesses/dashboard',
    '/businesses/9',
  ]

  it.each(protegidas)('%s manda al login sin token', (ruta) => {
    const memoria = renderRuta(ruta)

    expect(screen.getByText('pagina login')).toBeInTheDocument()
    expect(memoria.state.location.pathname).toBe('/login')
  })

  it.each([
    ['/', 'pagina home'],
    ['/reports', 'pagina feed'],
    ['/reports/new', 'pagina crear reporte'],
    ['/reports/5', 'pagina detalle reporte'],
    ['/chats', 'pagina chat'],
    ['/chats/3', 'pagina chat'],
    ['/businesses', 'pagina directorio comercios'],
    ['/businesses/register', 'pagina alta comercio'],
    ['/businesses/dashboard', 'pagina panel comercio'],
    ['/businesses/9', 'pagina perfil comercio'],
  ])('%s se renderiza con sesion', (ruta, texto) => {
    useAuthStore.getState().setAuth('jwt-de-prueba', usuario)

    renderRuta(ruta)

    expect(screen.getByText(texto)).toBeInTheDocument()
  })

  it('/businesses/dashboard no se confunde con el perfil /businesses/:id', () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', usuario)

    renderRuta('/businesses/dashboard')

    expect(screen.queryByText('pagina perfil comercio')).not.toBeInTheDocument()
  })
})

describe('router: rutas desconocidas', () => {
  it.each(['/no-existe', '/reports/5/otra/cosa'])('%s muestra NotFound', (ruta) => {
    renderRuta(ruta)

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
  })

  it('muestra NotFound aun con sesion', () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', usuario)

    renderRuta('/no-existe')

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
  })
})
