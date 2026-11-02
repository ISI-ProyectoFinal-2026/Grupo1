import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as businessService from '@/services/business.service'
import BusinessProfilePage from '@/pages/business/BusinessProfilePage'
import type { PublicBusiness } from '@/types/business.types'

vi.mock('@/services/business.service')

function comercioPublico(overrides: Partial<PublicBusiness> = {}): PublicBusiness {
  return {
    id: 9,
    name: 'Veterinaria San Roque',
    address: 'Av. Siempre Viva 123',
    phone: '1122334455',
    category: 'VETERINARIA',
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

  it('carga el perfil y registra la visita (GET dispara el evento VIEW)', async () => {
    vi.mocked(businessService.getBusiness).mockResolvedValue(comercioPublico())
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Veterinaria San Roque' })).toBeInTheDocument()
    expect(businessService.getBusiness).toHaveBeenCalledWith(9)
  })

  it('registra el contacto al tocar el boton y muestra la confirmacion', async () => {
    vi.mocked(businessService.getBusiness).mockResolvedValue(comercioPublico())
    vi.mocked(businessService.contactBusiness).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /contactar/i }))

    await waitFor(() => expect(businessService.contactBusiness).toHaveBeenCalledWith(9))
    expect(await screen.findByText(/registramos tu interés/i)).toBeInTheDocument()
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
