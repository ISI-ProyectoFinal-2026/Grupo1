import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as businessService from '@/services/business.service'
import BusinessRegisterPage from '@/pages/business/BusinessRegisterPage'
import type { Business } from '@/types/business.types'

vi.mock('@/services/business.service')

function comercio(overrides: Partial<Business> = {}): Business {
  return {
    id: 1,
    userId: 7,
    name: 'Veterinaria San Roque',
    cuit: '20-12345678-9',
    address: 'Av. Siempre Viva 123',
    phone: '1122334455',
    category: 'VETERINARIA',
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
      <MemoryRouter initialEntries={['/businesses/register']}>
        <Routes>
          <Route path="/businesses/register" element={<BusinessRegisterPage />} />
          <Route path="/businesses/dashboard" element={<div>Dashboard de comercio</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

describe('BusinessRegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza todos los campos del formulario', async () => {
    vi.mocked(businessService.getMyBusiness).mockRejectedValue(
      Object.assign(new Error('Comercio no encontrado'), { status: 404 })
    )
    renderPage()

    expect(await screen.findByLabelText('Nombre')).toBeInTheDocument()
    expect(screen.getByLabelText('CUIT')).toBeInTheDocument()
    expect(screen.getByLabelText('Domicilio')).toBeInTheDocument()
    expect(screen.getByLabelText('Teléfono')).toBeInTheDocument()
    expect(screen.getByLabelText('Rubro')).toBeInTheDocument()
    expect(screen.getByLabelText('Plan')).toBeInTheDocument()
  })

  it('envia el formulario con el payload esperado incluyendo el plan', async () => {
    vi.mocked(businessService.getMyBusiness).mockRejectedValue(
      Object.assign(new Error('Comercio no encontrado'), { status: 404 })
    )
    const creado = comercio({ plan: 'PREMIUM' })
    vi.mocked(businessService.createBusiness).mockResolvedValue(creado)
    const user = userEvent.setup()
    renderPage()

    await screen.findByLabelText('Nombre')
    await user.type(screen.getByLabelText('Nombre'), 'Veterinaria San Roque')
    await user.type(screen.getByLabelText('CUIT'), '20-12345678-9')
    await user.type(screen.getByLabelText('Domicilio'), 'Av. Siempre Viva 123')
    await user.type(screen.getByLabelText('Teléfono'), '1122334455')
    await user.selectOptions(screen.getByLabelText('Rubro'), 'VETERINARIA')
    await user.selectOptions(screen.getByLabelText('Plan'), 'PREMIUM')
    await user.click(screen.getByRole('button', { name: /registrar comercio/i }))

    await waitFor(() =>
      expect(businessService.createBusiness).toHaveBeenCalledWith({
        name: 'Veterinaria San Roque',
        cuit: '20-12345678-9',
        address: 'Av. Siempre Viva 123',
        phone: '1122334455',
        category: 'VETERINARIA',
        plan: 'PREMIUM',
      })
    )
    expect(await screen.findByText('Dashboard de comercio')).toBeInTheDocument()
  })

  it('muestra errores de campo cuando la API rechaza la creación', async () => {
    vi.mocked(businessService.getMyBusiness).mockRejectedValue(
      Object.assign(new Error('Comercio no encontrado'), { status: 404 })
    )
    vi.mocked(businessService.createBusiness).mockRejectedValue(
      Object.assign(new Error('Datos inválidos'), {
        details: [{ path: 'cuit', message: 'El CUIT ya está registrado' }],
      })
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByLabelText('Nombre')
    await user.type(screen.getByLabelText('Nombre'), 'Veterinaria San Roque')
    await user.type(screen.getByLabelText('CUIT'), '20-12345678-9')
    await user.type(screen.getByLabelText('Domicilio'), 'Av. Siempre Viva 123')
    await user.type(screen.getByLabelText('Teléfono'), '1122334455')
    await user.click(screen.getByRole('button', { name: /registrar comercio/i }))

    expect(await screen.findByText('El CUIT ya está registrado')).toBeInTheDocument()
  })

  it('redirige al dashboard si el usuario ya tiene un comercio registrado', async () => {
    vi.mocked(businessService.getMyBusiness).mockResolvedValue(comercio())
    renderPage()

    expect(await screen.findByText('Dashboard de comercio')).toBeInTheDocument()
  })
})
