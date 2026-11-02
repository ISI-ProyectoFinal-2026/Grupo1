import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import AdFlagList from '@/components/moderation/AdFlagList'
import type { AdFlagDTO } from '@/types/ad.types'

const denuncia: AdFlagDTO = {
  id: 5,
  adId: 7,
  userId: 9,
  reason: 'Promete algo falso',
  status: 'pending',
  createdAt: '2026-11-01T15:30:00.000Z',
  ad: {
    id: 7,
    title: 'Baño y corte -20%',
    body: 'Turnos de lunes a sábado',
    imageUrl: 'https://pub.r2.dev/ad.jpg',
    status: 'ACTIVE',
    business: { id: 3, name: 'Veterinaria Demo' },
  },
}

function renderList(onResolve = vi.fn()) {
  render(
    <MemoryRouter>
      <AdFlagList flags={[denuncia]} onResolve={onResolve} isResolving={false} />
    </MemoryRouter>
  )
  return onResolve
}

describe('AdFlagList', () => {
  it('muestra el anuncio denunciado, el comercio y el motivo', () => {
    renderList()

    const item = screen.getByRole('listitem')
    expect(within(item).getByText('Baño y corte -20%')).toBeInTheDocument()
    expect(within(item).getByText('Turnos de lunes a sábado')).toBeInTheDocument()
    expect(within(item).getByRole('link', { name: 'Veterinaria Demo' })).toHaveAttribute('href', '/businesses/3')
    expect(within(item).getByText('Promete algo falso')).toBeInTheDocument()
  })

  it('permite dar de baja el anuncio o desestimar la denuncia', async () => {
    const user = userEvent.setup()
    const onResolve = renderList()

    await user.click(screen.getByRole('button', { name: 'Dar de baja el anuncio' }))
    await user.click(screen.getByRole('button', { name: 'Desestimar' }))

    expect(onResolve).toHaveBeenNthCalledWith(1, 5, 'remove')
    expect(onResolve).toHaveBeenNthCalledWith(2, 5, 'dismiss')
  })

  it('mientras se resuelve una denuncia deshabilita todas (dar de baja cierra las del mismo anuncio)', () => {
    render(
      <MemoryRouter>
        <AdFlagList flags={[denuncia, { ...denuncia, id: 6, reason: 'Otra denuncia' }]} onResolve={vi.fn()} isResolving />
      </MemoryRouter>
    )

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled()
    }
  })

  it('sin denuncias muestra el estado vacío', () => {
    render(
      <MemoryRouter>
        <AdFlagList flags={[]} onResolve={vi.fn()} isResolving={false} />
      </MemoryRouter>
    )

    expect(screen.getByText('No hay anuncios pendientes de moderación')).toBeInTheDocument()
  })
})
