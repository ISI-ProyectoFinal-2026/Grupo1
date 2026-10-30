import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as businessService from '@/services/business.service'
import BusinessDashboardPage from '@/pages/business/BusinessDashboardPage'
import type { Business } from '@/types/business.types'

vi.mock('@/services/business.service')

// doble del selector: expone el pin inicial y un boton que dispara un pin nuevo
vi.mock('@/components/maps/LocationPicker', () => ({
  default: ({
    onLocationSelect,
    initialLocation,
  }: {
    onLocationSelect: (loc: { lat: number; lng: number }, address: string) => void
    initialLocation?: { lat: number; lng: number } | null
  }) => (
    <button
      type='button'
      data-initial-location={initialLocation ? `${initialLocation.lat},${initialLocation.lng}` : ''}
      onClick={() => onLocationSelect({ lat: -34.6251, lng: -68.3221 }, '-34.6251, -68.3221')}
    >
      Mover ubicación
    </button>
  ),
}))

function comercio(overrides: Partial<Business> = {}): Business {
  return {
    id: 1,
    userId: 7,
    name: 'Veterinaria San Roque',
    cuit: '20-12345678-9',
    address: 'Av. Siempre Viva 123',
    phone: '1122334455',
    category: 'VETERINARIA',
    latitude: null,
    longitude: null,
    plan: 'FREE',
    planExpiresAt: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={['/businesses/dashboard']}>
        <Routes>
          <Route path="/businesses/dashboard" element={<BusinessDashboardPage />} />
          <Route path="/businesses/register" element={<div>Registrar comercio</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

describe('BusinessDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra las estadisticas y el plan actual', async () => {
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(comercio({ plan: 'PREMIUM' }))
    vi.mocked(businessService.getMyBusinessStats).mockResolvedValue({ views: 12, contacts: 3 })
    renderPage()

    await waitFor(() => expect(screen.getByTestId('stat-views')).toHaveTextContent('12'))
    expect(screen.getByTestId('stat-contacts')).toHaveTextContent('3')
    expect(screen.getByTestId('current-plan')).toHaveTextContent('Premium')
  })

  it('edita el comercio y refleja el cambio persistido', async () => {
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(comercio())
    vi.mocked(businessService.getMyBusinessStats).mockResolvedValue({ views: 0, contacts: 0 })
    vi.mocked(businessService.updateMyBusiness).mockResolvedValue(
      comercio({ phone: '1199998888' })
    )
    const user = userEvent.setup()
    renderPage()

    const phoneInput = await screen.findByLabelText('Teléfono')
    await user.clear(phoneInput)
    await user.type(phoneInput, '1199998888')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() =>
      expect(businessService.updateMyBusiness).toHaveBeenCalledWith({
        name: 'Veterinaria San Roque',
        address: 'Av. Siempre Viva 123',
        phone: '1199998888',
        category: 'VETERINARIA',
      })
    )
    expect(await screen.findByText(/cambios guardados/i)).toBeInTheDocument()
  })

  it('precarga el pin con las coordenadas guardadas del comercio', async () => {
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(
      comercio({ latitude: -34.6, longitude: -58.4 })
    )
    vi.mocked(businessService.getMyBusinessStats).mockResolvedValue({ views: 0, contacts: 0 })
    renderPage()

    const picker = await screen.findByRole('button', { name: 'Mover ubicación' })
    expect(picker).toHaveAttribute('data-initial-location', '-34.6,-58.4')
  })

  it('no precarga pin si el comercio no tiene coordenadas', async () => {
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(comercio())
    vi.mocked(businessService.getMyBusinessStats).mockResolvedValue({ views: 0, contacts: 0 })
    renderPage()

    const picker = await screen.findByRole('button', { name: 'Mover ubicación' })
    expect(picker).toHaveAttribute('data-initial-location', '')
  })

  it('envia la ubicacion nueva al mover el pin y guardar', async () => {
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(comercio())
    vi.mocked(businessService.getMyBusinessStats).mockResolvedValue({ views: 0, contacts: 0 })
    vi.mocked(businessService.updateMyBusiness).mockResolvedValue(
      comercio({ latitude: -34.6251, longitude: -68.3221 })
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Mover ubicación' }))
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() =>
      expect(businessService.updateMyBusiness).toHaveBeenCalledWith({
        name: 'Veterinaria San Roque',
        address: 'Av. Siempre Viva 123',
        phone: '1122334455',
        category: 'VETERINARIA',
        location: { lat: -34.6251, lng: -68.3221 },
      })
    )
    expect(await screen.findByText(/cambios guardados/i)).toBeInTheDocument()
  })

  it('no ofrece cambiar el plan: la API lo ignora al editar el perfil', async () => {
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(comercio())
    vi.mocked(businessService.getMyBusinessStats).mockResolvedValue({ views: 0, contacts: 0 })
    renderPage()

    await screen.findByLabelText('Teléfono')
    expect(screen.queryByLabelText('Plan')).not.toBeInTheDocument()
    expect(screen.getByTestId('current-plan')).toHaveTextContent('Gratis')
  })

  it('redirige al registro si el usuario no tiene comercio', async () => {
    vi.mocked(businessService.getMyBusiness).mockRejectedValue(
      Object.assign(new Error('Comercio no encontrado'), { status: 404 })
    )
    renderPage()

    expect(await screen.findByText('Registrar comercio')).toBeInTheDocument()
  })
})
