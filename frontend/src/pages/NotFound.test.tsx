import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import NotFound from '@/pages/NotFound'

function renderNotFound() {
  return render(
    <MemoryRouter initialEntries={['/', '/ruta-inexistente']} initialIndex={1}>
      <Routes>
        <Route path='/' element={<div>Inicio</div>} />
        <Route path='*' element={<NotFound />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('NotFound', () => {
  it('muestra el 404 con una explicacion', () => {
    renderNotFound()

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
  })

  it('vuelve a la pantalla anterior con "Volver atrás"', async () => {
    const user = userEvent.setup()
    renderNotFound()

    await user.click(screen.getByRole('button', { name: '← Volver atrás' }))

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
  })

  it('navega al inicio con "Ir a inicio"', async () => {
    const user = userEvent.setup()
    renderNotFound()

    await user.click(screen.getByRole('button', { name: 'Ir a inicio' }))

    expect(await screen.findByText('Inicio')).toBeInTheDocument()
  })
})
