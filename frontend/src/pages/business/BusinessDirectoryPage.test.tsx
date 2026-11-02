import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as businessService from '@/services/business.service'
import BusinessDirectoryPage from '@/pages/business/BusinessDirectoryPage'
import type { PublicBusiness } from '@/types/business.types'

vi.mock('@/services/business.service')
vi.mock('react-leaflet', () => import('@/test/react-leaflet-mock'))

function comercioPublico(overrides: Partial<PublicBusiness> = {}): PublicBusiness {
  return {
    id: 1,
    name: 'Veterinaria San Roque',
    address: 'Av. Siempre Viva 123',
    phone: '1122334455',
    category: 'VETERINARIA',
    latitude: -34.6251,
    longitude: -68.3221,
    plan: 'FREE',
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={['/businesses']}>
        <Routes>
          <Route path="/businesses" element={<BusinessDirectoryPage />} />
          <Route path="/businesses/:id" element={<div>Perfil del comercio</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

describe('BusinessDirectoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista los comercios que devuelve el directorio', async () => {
    vi.mocked(businessService.listBusinesses).mockResolvedValue([
      comercioPublico({ id: 1, name: 'Veterinaria San Roque' }),
      comercioPublico({ id: 2, name: 'Refugio Esperanza', category: 'REFUGIO' }),
    ])
    renderPage()

    expect(await screen.findByRole('heading', { level: 2, name: 'Veterinaria San Roque' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Refugio Esperanza' })).toBeInTheDocument()
  })

  it('dibuja en el mapa solo los comercios con ubicacion', async () => {
    vi.mocked(businessService.listBusinesses).mockResolvedValue([
      comercioPublico({ id: 1, name: 'Veterinaria San Roque' }),
      comercioPublico({ id: 2, name: 'Refugio Esperanza', latitude: null, longitude: null }),
    ])
    renderPage()

    await screen.findByRole('heading', { level: 2, name: 'Refugio Esperanza' })

    expect(screen.getAllByTestId('marker')).toHaveLength(1)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-position', '-34.6251,-68.3221')
  })

  it('no muestra el mapa si ningun comercio tiene ubicacion', async () => {
    vi.mocked(businessService.listBusinesses).mockResolvedValue([
      comercioPublico({ latitude: null, longitude: null }),
    ])
    renderPage()

    await screen.findByRole('heading', { level: 2, name: 'Veterinaria San Roque' })

    expect(screen.queryByTestId('map')).not.toBeInTheDocument()
  })

  it('muestra el estado vacio cuando no hay comercios', async () => {
    vi.mocked(businessService.listBusinesses).mockResolvedValue([])
    renderPage()

    expect(await screen.findByText(/no hay comercios registrados/i)).toBeInTheDocument()
  })

  it('filtra por categoria al cambiar el select', async () => {
    vi.mocked(businessService.listBusinesses).mockResolvedValue([comercioPublico()])
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { level: 2, name: 'Veterinaria San Roque' })
    await user.selectOptions(screen.getByLabelText('Rubro'), 'REFUGIO')

    await waitFor(() =>
      expect(businessService.listBusinesses).toHaveBeenCalledWith('REFUGIO')
    )
  })
})
