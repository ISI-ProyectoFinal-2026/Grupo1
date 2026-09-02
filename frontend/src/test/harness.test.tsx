import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

// smoke test: valida jsdom, JSX y matchers de jest-dom
function Saludo({ nombre }: { nombre: string }) {
  return <p>Hola {nombre}</p>
}

describe('harness de tests', () => {
  it('renderiza un componente en jsdom', () => {
    render(<Saludo nombre='Patitas' />)
    expect(screen.getByText('Hola Patitas')).toBeInTheDocument()
  })

  it('limpia el DOM entre tests', () => {
    expect(screen.queryByText('Hola Patitas')).not.toBeInTheDocument()
  })
})
