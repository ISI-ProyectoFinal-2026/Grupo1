import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as adsService from '@/services/ads.service'
import AdsSection from '@/components/business/AdsSection'
import type { Ad } from '@/types/ad.types'
import type { Business } from '@/types/business.types'

vi.mock('@/services/ads.service')

// doble del uploader: un botón que "sube" una imagen del bucket
vi.mock('@/components/reports/ImageUploader', () => ({
  default: ({ onSuccess }: { onSuccess: (url: string, rejection: null, warning: null) => void }) => (
    <button type='button' onClick={() => onSuccess('https://pub.r2.dev/nueva.jpg', null, null)}>
      Subir imagen
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
    latitude: -34.6,
    longitude: -68.33,
    description: null,
    website: null,
    socialLinks: [],
    plan: 'PREMIUM',
    planExpiresAt: '2026-12-01T12:00:00.000Z',
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

function anuncio(overrides: Partial<Ad> = {}): Ad {
  return {
    id: 1,
    businessId: 1,
    title: 'Vacunación antirrábica',
    body: '20% off todo noviembre',
    imageUrl: 'https://pub.r2.dev/a.jpg',
    radiusKm: 5,
    status: 'ACTIVE',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  }
}

function renderSection(business: Business) {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter>
        <AdsSection business={business} />
      </MemoryRouter>
    </Wrapper>
  )
}

describe('AdsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adsService.listMyAds).mockResolvedValue([])
  })

  it('un comercio Gratis ve la invitación a Premium y no puede crear anuncios', async () => {
    renderSection(comercio({ plan: 'FREE', planExpiresAt: null }))

    expect(await screen.findByText(/Los anuncios son parte del plan Premium/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver plan Premium' })).toHaveAttribute('href', '/businesses/plan')
    expect(screen.queryByRole('button', { name: 'Nuevo anuncio' })).not.toBeInTheDocument()
  })

  it('con el plan vencido avisa que los anuncios activos no se muestran', async () => {
    vi.mocked(adsService.listMyAds).mockResolvedValue([anuncio()])
    renderSection(comercio({ plan: 'FREE', planExpiresAt: null }))

    expect(await screen.findByText(/no se muestran porque tu plan Premium venció/i)).toBeInTheDocument()
  })

  it('sin ubicación en el mapa pide cargarla antes de publicar', async () => {
    renderSection(comercio({ latitude: null, longitude: null }))

    expect(await screen.findByText(/Cargá la ubicación del comercio en el mapa/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo anuncio' })).not.toBeInTheDocument()
  })

  it('lista los anuncios con su estado y el contador de activos', async () => {
    vi.mocked(adsService.listMyAds).mockResolvedValue([
      anuncio({ id: 1, title: 'Activo uno' }),
      anuncio({ id: 2, title: 'Promo pausada', status: 'PAUSED' }),
      anuncio({ id: 3, title: 'Dado de baja', status: 'REMOVED' }),
    ])
    renderSection(comercio())

    expect(await screen.findByText('1 de 3 anuncios activos')).toBeInTheDocument()
    const removed = screen.getByRole('article', { name: 'Dado de baja' })
    expect(within(removed).getByText('Dado de baja por moderación')).toBeInTheDocument()
    expect(within(removed).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(within(removed).queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Promo pausada' })).getByText('Pausado')).toBeInTheDocument()
  })

  it('con 3 activos no permite crear otro', async () => {
    vi.mocked(adsService.listMyAds).mockResolvedValue([anuncio({ id: 1 }), anuncio({ id: 2 }), anuncio({ id: 3 })])
    renderSection(comercio())

    expect(await screen.findByText('3 de 3 anuncios activos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo anuncio' })).toBeDisabled()
    expect(screen.getByText(/Pausá uno para publicar otro/)).toBeInTheDocument()
  })

  it('crea un anuncio con imagen, título, texto y radio', async () => {
    vi.mocked(adsService.createAd).mockResolvedValue(anuncio({ id: 9 }))
    const user = userEvent.setup()
    renderSection(comercio())

    await screen.findByText('0 de 3 anuncios activos')
    await user.click(screen.getByRole('button', { name: 'Nuevo anuncio' }))
    await user.type(screen.getByLabelText('Título'), 'Baño y corte')
    await user.type(screen.getByLabelText('Texto'), 'Turnos todos los días')
    await user.click(screen.getByRole('button', { name: 'Subir imagen' }))
    const radius = screen.getByLabelText('Radio de alcance (km)')
    await user.clear(radius)
    await user.type(radius, '12')
    await user.click(screen.getByRole('button', { name: 'Publicar anuncio' }))

    await waitFor(() =>
      expect(adsService.createAd).toHaveBeenCalledWith({
        title: 'Baño y corte',
        body: 'Turnos todos los días',
        imageUrl: 'https://pub.r2.dev/nueva.jpg',
        radiusKm: 12,
      })
    )
  })

  it('no publica sin imagen', async () => {
    const user = userEvent.setup()
    renderSection(comercio())

    await screen.findByText('0 de 3 anuncios activos')
    await user.click(screen.getByRole('button', { name: 'Nuevo anuncio' }))
    await user.type(screen.getByLabelText('Título'), 'Baño y corte')
    await user.type(screen.getByLabelText('Texto'), 'Turnos')
    await user.click(screen.getByRole('button', { name: 'Publicar anuncio' }))

    expect(await screen.findByText('Subí una imagen para el anuncio')).toBeInTheDocument()
    expect(adsService.createAd).not.toHaveBeenCalled()
  })

  it('muestra el error del backend al crear', async () => {
    vi.mocked(adsService.createAd).mockRejectedValue(new Error('Podés tener hasta 3 anuncios activos'))
    const user = userEvent.setup()
    renderSection(comercio())

    await screen.findByText('0 de 3 anuncios activos')
    await user.click(screen.getByRole('button', { name: 'Nuevo anuncio' }))
    await user.type(screen.getByLabelText('Título'), 'x')
    await user.type(screen.getByLabelText('Texto'), 'y')
    await user.click(screen.getByRole('button', { name: 'Subir imagen' }))
    await user.click(screen.getByRole('button', { name: 'Publicar anuncio' }))

    expect(await screen.findByText('Podés tener hasta 3 anuncios activos')).toBeInTheDocument()
  })

  it('edita un anuncio existente', async () => {
    vi.mocked(adsService.listMyAds).mockResolvedValue([anuncio()])
    vi.mocked(adsService.updateAd).mockResolvedValue(anuncio({ title: 'Nuevo título' }))
    const user = userEvent.setup()
    renderSection(comercio())

    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    const title = screen.getByLabelText('Título')
    expect(title).toHaveValue('Vacunación antirrábica')
    await user.clear(title)
    await user.type(title, 'Nuevo título')
    await user.click(screen.getByRole('button', { name: 'Guardar anuncio' }))

    await waitFor(() =>
      expect(adsService.updateAd).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Nuevo título' }))
    )
  })

  it('al editar muestra una sola imagen y el selector aparece solo al pedir cambiarla', async () => {
    vi.mocked(adsService.listMyAds).mockResolvedValue([anuncio()])
    vi.mocked(adsService.updateAd).mockResolvedValue(anuncio())
    const user = userEvent.setup()
    renderSection(comercio())

    await user.click(await screen.findByRole('button', { name: 'Editar' }))

    expect(screen.getByRole('img', { name: 'Imagen del anuncio' })).toHaveAttribute('src', 'https://pub.r2.dev/a.jpg')
    expect(screen.queryByRole('button', { name: 'Subir imagen' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cambiar imagen' }))
    await user.click(screen.getByRole('button', { name: 'Subir imagen' }))

    expect(screen.getByRole('img', { name: 'Imagen del anuncio' })).toHaveAttribute('src', 'https://pub.r2.dev/nueva.jpg')
    expect(screen.queryByRole('button', { name: 'Subir imagen' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar anuncio' }))
    await waitFor(() =>
      expect(adsService.updateAd).toHaveBeenCalledWith(1, expect.objectContaining({ imageUrl: 'https://pub.r2.dev/nueva.jpg' }))
    )
  })

  it('al crear muestra el selector y, una vez subida, la imagen con la opción de cambiarla', async () => {
    const user = userEvent.setup()
    renderSection(comercio())

    await screen.findByText('0 de 3 anuncios activos')
    await user.click(screen.getByRole('button', { name: 'Nuevo anuncio' }))
    expect(screen.queryByRole('img', { name: 'Imagen del anuncio' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Subir imagen' }))

    expect(screen.getByRole('img', { name: 'Imagen del anuncio' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar imagen' })).toBeInTheDocument()
  })

  it('pausa y activa un anuncio', async () => {
    vi.mocked(adsService.listMyAds).mockResolvedValue([anuncio()])
    vi.mocked(adsService.setAdStatus).mockResolvedValue(anuncio({ status: 'PAUSED' }))
    const user = userEvent.setup()
    renderSection(comercio())

    await user.click(await screen.findByRole('button', { name: 'Pausar' }))

    await waitFor(() => expect(adsService.setAdStatus).toHaveBeenCalledWith(1, 'PAUSED'))
  })

  it('elimina un anuncio después de confirmar', async () => {
    vi.mocked(adsService.listMyAds).mockResolvedValue([anuncio()])
    vi.mocked(adsService.deleteAd).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderSection(comercio())

    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    expect(adsService.deleteAd).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))

    await waitFor(() => expect(adsService.deleteAd).toHaveBeenCalledWith(1))
  })

  it('muestra las métricas de un anuncio', async () => {
    vi.mocked(adsService.listMyAds).mockResolvedValue([anuncio()])
    vi.mocked(adsService.getAdStats).mockResolvedValue({
      impressions: 200,
      clicks: 10,
      ctr: 0.05,
      daily: [
        { date: '2026-10-31', impressions: 0, clicks: 0 },
        { date: '2026-11-01', impressions: 200, clicks: 10 },
      ],
      byPlacement: [
        { placement: 'feed', impressions: 150, clicks: 6 },
        { placement: 'report_detail', impressions: 50, clicks: 4 },
      ],
    })
    const user = userEvent.setup()
    renderSection(comercio())

    await user.click(await screen.findByRole('button', { name: 'Ver métricas' }))

    const stats = await screen.findByRole('region', { name: 'Métricas de Vacunación antirrábica' })
    expect(within(stats).getByTestId('ad-impressions')).toHaveTextContent('200')
    expect(within(stats).getByTestId('ad-clicks')).toHaveTextContent('10')
    expect(within(stats).getByTestId('ad-ctr')).toHaveTextContent('5,0%')
    expect(within(stats).getByRole('row', { name: /Feed 150 6/ })).toBeInTheDocument()
    expect(within(stats).getByRole('row', { name: /Detalle del reporte 50 4/ })).toBeInTheDocument()
    expect(within(stats).getByRole('row', { name: /1 nov 200 10/ })).toBeInTheDocument()
    expect(within(stats).queryByRole('row', { name: /31 oct/ })).not.toBeInTheDocument()
  })
})
