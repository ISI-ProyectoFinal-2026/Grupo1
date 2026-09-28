import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

function Explota(): never {
  throw new Error('fallo al renderizar el feed')
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React loguea el error capturado por consola aunque el boundary lo maneje;
    // silenciarlo evita ensuciar la salida del test sin ocultar fallas reales.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deja pasar a los hijos cuando no hay error', () => {
    render(
      <ErrorBoundary>
        <p>Contenido normal</p>
      </ErrorBoundary>
    )

    expect(screen.getByText('Contenido normal')).toBeInTheDocument()
    expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument()
  })

  it('muestra el fallback con el mensaje del error', () => {
    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>
    )

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()
    expect(screen.getByText('fallo al renderizar el feed')).toBeInTheDocument()
  })

  it('vuelve al inicio al tocar recargar', async () => {
    const locationFalsa = { href: '/reports/5' }
    Object.defineProperty(window, 'location', {
      value: locationFalsa,
      writable: true,
      configurable: true,
    })
    const user = userEvent.setup()
    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>
    )

    await user.click(screen.getByRole('button', { name: 'Recargar página' }))

    expect(locationFalsa.href).toBe('/')
  })
})
