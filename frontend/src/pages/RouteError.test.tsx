import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RouteError from '@/pages/RouteError'

function Explota(): never {
  throw new Error('fallo al renderizar el detalle')
}

function renderRuta(ruta: string, routes: RouteObject[] = [{ path: '/', element: <Explota />, errorElement: <RouteError /> }]) {
  const memoria = createMemoryRouter(routes, { initialEntries: [ruta] })
  render(<RouterProvider router={memoria} />)
  return memoria
}

describe('RouteError (#329)', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('una ruta inexistente sigue mostrando NotFound', () => {
    renderRuta('/no-existe')

    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Algo salió mal' })).not.toBeInTheDocument()
  })

  it('un error de render muestra la pantalla de error inesperado, no el 404', () => {
    renderRuta('/')

    expect(screen.getByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument()
    expect(screen.getByText('fallo al renderizar el detalle')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Página no encontrada' })).not.toBeInTheDocument()
  })

  it('registra el error con el mensaje original', () => {
    renderRuta('/')

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[router]'),
      expect.objectContaining({ message: 'fallo al renderizar el detalle' })
    )
  })

  it('una respuesta de error que no es 404 muestra el error inesperado con su estado', async () => {
    renderRuta('/', [
      {
        path: '/',
        element: <p>contenido</p>,
        errorElement: <RouteError />,
        loader: () => {
          throw new Response(null, { status: 500, statusText: 'Internal Server Error' })
        },
      },
    ])

    expect(await screen.findByRole('heading', { name: 'Algo salió mal' })).toBeInTheDocument()
    expect(screen.getByText('500 Internal Server Error')).toBeInTheDocument()
  })

  it('ofrece ir al inicio con un enlace', () => {
    renderRuta('/')

    expect(screen.getByRole('link', { name: 'Ir a inicio' })).toHaveAttribute('href', '/')
  })

  it('reintentar recarga la página', async () => {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
      configurable: true,
    })
    const user = userEvent.setup()
    renderRuta('/')

    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(reload).toHaveBeenCalled()
  })
})
