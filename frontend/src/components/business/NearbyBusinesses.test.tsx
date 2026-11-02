import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as adsService from '@/services/ads.service'
import NearbyBusinesses from '@/components/business/NearbyBusinesses'

vi.mock('@/services/ads.service')

function renderBlock() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter>
        <NearbyBusinesses reportId={12} />
      </MemoryRouter>
    </Wrapper>
  )
}

describe('NearbyBusinesses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista los comercios cercanos con distancia y marca los destacados', async () => {
    vi.mocked(adsService.getNearbyBusinesses).mockResolvedValue([
      { id: 1, name: 'Zoo Pet Shop', category: 'PET_SHOP', address: 'Yrigoyen 900', phone: '1', distanceKm: 3.4, featured: true },
      { id: 2, name: 'Veterinaria Centro', category: 'VETERINARIA', address: 'Mitre 500', phone: '2', distanceKm: 0.8, featured: false },
    ])
    renderBlock()

    const list = await screen.findByRole('list', { name: 'Comercios adheridos cerca' })
    const items = within(list).getAllByRole('listitem')
    expect(within(items[0]).getByText('Zoo Pet Shop')).toBeInTheDocument()
    expect(within(items[0]).getByText('Destacado')).toBeInTheDocument()
    expect(within(items[0]).getByText('a 3,4 km')).toBeInTheDocument()
    expect(within(items[1]).queryByText('Destacado')).not.toBeInTheDocument()
    expect(within(items[0]).getByRole('link')).toHaveAttribute('href', '/businesses/1')
    expect(adsService.getNearbyBusinesses).toHaveBeenCalledWith(12)
  })

  it('sin comercios cerca no muestra el bloque', async () => {
    vi.mocked(adsService.getNearbyBusinesses).mockResolvedValue([])
    const { container } = renderBlock()

    await vi.waitFor(() => expect(adsService.getNearbyBusinesses).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
