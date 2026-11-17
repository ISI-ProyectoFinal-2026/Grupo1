import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as businessService from '@/services/business.service'
import BusinessProfilePage from '@/pages/business/BusinessProfilePage'
import { useAuthStore } from '@/stores/auth.store'
import type { PublicBusiness } from '@/types/business.types'

vi.mock('@/services/business.service')
vi.mock('react-leaflet', () => import('@/test/react-leaflet-mock'))

function comercioPublico(overrides: Partial<PublicBusiness> = {}): PublicBusiness {
  return {
    id: 9,
    name: 'Veterinaria San Roque',
    address: 'Av. Siempre Viva 123',
    phone: '1122334455',
    category: 'VETERINARIA',
    latitude: -34.6251,
    longitude: -68.3221,
    plan: 'FREE',
    description: null,
    website: null,
    socialLinks: [],
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={['/businesses/9']}>
        <Routes>
          <Route path="/businesses/:id" element={<BusinessProfilePage />} />
          <Route path="/businesses" element={<div>Directorio</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

describe('BusinessProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('carga el perfil y registra la visita (GET dispara el evento VIEW)', async () => {
    vi.mocked(businessService.getBusiness).mockResolvedValue(comercioPublico())
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Veterinaria San Roque' })).toBeInTheDocument()
    expect(businessService.getBusiness).toHaveBeenCalledWith(9)
  })

  it('muestra el pin del comercio en el mapa', async () => {
    vi.mocked(businessService.getBusiness).mockResolvedValue(comercioPublico())
    renderPage()

    await screen.findByRole('heading', { name: 'Veterinaria San Roque' })

    expect(screen.getByTestId('marker')).toHaveAttribute('data-position', '-34.6251,-68.3221')
  })

  it('no muestra el mapa si el comercio no tiene ubicacion', async () => {
    vi.mocked(businessService.getBusiness).mockResolvedValue(
      comercioPublico({ latitude: null, longitude: null })
    )
    renderPage()

    await screen.findByRole('heading', { name: 'Veterinaria San Roque' })

    expect(screen.queryByTestId('map')).not.toBeInTheDocument()
  })

  it('registra el contacto al tocar el boton y muestra la confirmacion', async () => {
    useAuthStore.setState({
      token: 'token',
      user: {
        id: 8,
        email: 'vecino@patitas.test',
        fullName: null,
        phone: null,
        role: 'usuario_regular',
        emailVerifiedAt: '2026-09-01T10:00:00.000Z',
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T10:00:00.000Z',
      },
    })
    vi.mocked(businessService.getBusiness).mockResolvedValue(comercioPublico())
    vi.mocked(businessService.contactBusiness).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /contactar/i }))

    await waitFor(() => expect(businessService.contactBusiness).toHaveBeenCalledWith(9))
    expect(await screen.findByText(/registramos tu interés/i)).toBeInTheDocument()
  })

  // registrar el contacto exige sesion; el telefono ya queda a la vista (#187)
  it('sin sesion muestra el perfil sin el boton de contactar', async () => {
    vi.mocked(businessService.getBusiness).mockResolvedValue(comercioPublico())
    renderPage()

    await screen.findByRole('heading', { name: 'Veterinaria San Roque' })

    expect(screen.getByText('1122334455')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /contactar/i })).not.toBeInTheDocument()
  })

  it('muestra la descripción y los enlaces externos en una pestaña nueva', async () => {
    vi.mocked(businessService.getBusiness).mockResolvedValue(
      comercioPublico({
        description: 'Guardia 24 hs y peluquería.',
        website: 'https://vetsanroque.com.ar',
        socialLinks: ['https://instagram.com/vetsanroque'],
      })
    )
    renderPage()

    expect(await screen.findByText('Guardia 24 hs y peluquería.')).toBeInTheDocument()
    const web = screen.getByRole('link', { name: 'vetsanroque.com.ar' })
    expect(web).toHaveAttribute('href', 'https://vetsanroque.com.ar')
    expect(web).toHaveAttribute('target', '_blank')
    expect(web).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: 'instagram.com/vetsanroque' })).toBeInTheDocument()
  })

  it('no repite un enlace cargado como web y como red', async () => {
    vi.mocked(businessService.getBusiness).mockResolvedValue(
      comercioPublico({ website: 'https://vet.com', socialLinks: ['https://vet.com', 'https://instagram.com/vet'] })
    )
    renderPage()

    expect(await screen.findAllByRole('link', { name: 'vet.com' })).toHaveLength(1)
  })

  it('sin descripción ni enlaces no muestra esas secciones', async () => {
    vi.mocked(businessService.getBusiness).mockResolvedValue(comercioPublico())
    renderPage()

    await screen.findByRole('heading', { name: 'Veterinaria San Roque' })
    expect(screen.queryByText('Enlaces')).not.toBeInTheDocument()
  })

  it('muestra un error si el comercio no se puede cargar', async () => {
    vi.mocked(businessService.getBusiness).mockRejectedValue(new Error('no existe'))
    renderPage()

    expect(await screen.findByText(/no se pudo cargar el comercio/i)).toBeInTheDocument()
  })
})
