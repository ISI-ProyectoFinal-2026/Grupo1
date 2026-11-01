import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as businessService from '@/services/business.service'
import BusinessPlanPage from '@/pages/business/BusinessPlanPage'
import type { Business, PlanOffer } from '@/types/business.types'

vi.mock('@/services/business.service')

const PLANES: PlanOffer[] = [
  { plan: 'PREMIUM', period: 'MONTHLY', months: 1, priceUsd: 30 },
  { plan: 'PREMIUM', period: 'ANNUAL', months: 12, priceUsd: 300 },
]

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
      <MemoryRouter initialEntries={['/businesses/plan']}>
        <Routes>
          <Route path="/businesses/plan" element={<BusinessPlanPage />} />
          <Route path="/businesses/register" element={<div>Registrar comercio</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

describe('BusinessPlanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(businessService.getPlans).mockResolvedValue(PLANES)
  })

  it('muestra los precios mensual y anual con el ahorro del anual', async () => {
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(comercio())
    renderPage()

    expect(await screen.findByRole('radio', { name: /Mensual/ })).toBeInTheDocument()
    expect(screen.getByText('USD 30')).toBeInTheDocument()
    expect(screen.getByText('USD 300')).toBeInTheDocument()
    expect(screen.getByText(/Ahorrás USD 60/)).toBeInTheDocument()
  })

  it('avisa que el pago es simulado y no se cobra', async () => {
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(comercio())
    renderPage()

    expect(await screen.findByText(/pago simulado/i)).toBeInTheDocument()
  })

  it('compra el período elegido y muestra el vencimiento nuevo', async () => {
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(comercio())
    vi.mocked(businessService.subscribe).mockResolvedValue({
      business: comercio({ plan: 'PREMIUM', planExpiresAt: '2027-11-15T12:00:00.000Z' }),
      subscription: { id: 1, period: 'ANNUAL', amountUsd: '300', status: 'APPROVED', provider: 'fake' },
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('radio', { name: /Anual/ }))
    await user.click(screen.getByRole('button', { name: 'Pasar a Premium' }))

    await waitFor(() => expect(businessService.subscribe).toHaveBeenCalledWith('ANNUAL'))
    expect(await screen.findByRole('status')).toHaveTextContent(/15 de noviembre de 2027/)
    expect(screen.getByTestId('current-plan')).toHaveTextContent('Premium')
  })

  it('con Premium vigente ofrece renovar y explica que se suma al vencimiento', async () => {
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(
      comercio({ plan: 'PREMIUM', planExpiresAt: '2026-12-01T12:00:00.000Z' })
    )
    renderPage()

    expect(await screen.findByRole('button', { name: 'Renovar Premium' })).toBeInTheDocument()
    expect(screen.getByText(/se suma a tu vencimiento actual/i)).toBeInTheDocument()
    expect(screen.getByTestId('current-plan')).toHaveTextContent('Premium')
  })

  it('muestra el error si la compra falla', async () => {
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(comercio())
    vi.mocked(businessService.subscribe).mockRejectedValue(new Error('El pago fue rechazado'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Pasar a Premium' }))

    expect(await screen.findByText('El pago fue rechazado')).toBeInTheDocument()
  })

  it('redirige al registro si el usuario no tiene comercio', async () => {
    vi.mocked(businessService.getMyBusiness).mockRejectedValue(
      Object.assign(new Error('Comercio no encontrado'), { status: 404 })
    )
    renderPage()

    expect(await screen.findByText('Registrar comercio')).toBeInTheDocument()
  })
})
