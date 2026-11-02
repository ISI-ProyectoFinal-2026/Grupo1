import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as adsService from '@/services/ads.service'
import AdBanner from '@/components/ads/AdBanner'
import type { ServedAd } from '@/types/ad.types'

vi.mock('@/services/ads.service')

const anuncio: ServedAd = {
  id: 7,
  title: 'Baño y corte -20%',
  body: 'Turnos de lunes a sábado',
  imageUrl: 'https://pub.r2.dev/ad.jpg',
  business: { id: 3, name: 'Veterinaria Demo', category: 'VETERINARIA' },
  segmented: true,
  isOwn: false,
}

// IntersectionObserver controlable: el test decide cuándo el banner entra en pantalla
let triggerVisible: () => void = () => {}
class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    triggerVisible = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never)
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

function renderBanner(props: { placement: 'feed' | 'report_detail'; reportId?: number }, client?: QueryClient) {
  const { Wrapper } = createQueryWrapper(client)
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={['/reports']}>
        <Routes>
          <Route path="/reports" element={<AdBanner {...props} />} />
          <Route path="/businesses/:id" element={<div>Perfil del comercio</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

describe('AdBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    vi.mocked(adsService.getAdFor).mockResolvedValue(anuncio)
    vi.mocked(adsService.recordAdEvent).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('muestra el anuncio marcado como publicidad y con el comercio', async () => {
    renderBanner({ placement: 'feed' })

    expect(await screen.findByText('Publicidad')).toBeInTheDocument()
    expect(screen.getByText('Baño y corte -20%')).toBeInTheDocument()
    expect(screen.getByText('Veterinaria Demo')).toBeInTheDocument()
    expect(adsService.getAdFor).toHaveBeenCalledWith('feed', undefined)
  })

  it('pide el anuncio del detalle con el id del reporte', async () => {
    renderBanner({ placement: 'report_detail', reportId: 12 })

    await screen.findByText('Publicidad')
    expect(adsService.getAdFor).toHaveBeenCalledWith('report_detail', 12)
  })

  it('sin anuncios no muestra nada', async () => {
    vi.mocked(adsService.getAdFor).mockResolvedValue(null)
    const { container } = renderBanner({ placement: 'feed' })

    await waitFor(() => expect(adsService.getAdFor).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('registra la impresión una sola vez por sesión cuando entra en pantalla', async () => {
    renderBanner({ placement: 'feed' })
    await screen.findByText('Publicidad')
    expect(adsService.recordAdEvent).not.toHaveBeenCalled()

    act(() => triggerVisible())
    act(() => triggerVisible())

    expect(adsService.recordAdEvent).toHaveBeenCalledTimes(1)
    expect(adsService.recordAdEvent).toHaveBeenCalledWith(7, 'impression', 'feed')
  })

  it('no repite la impresión al volver a montar en la misma sesión', async () => {
    const first = renderBanner({ placement: 'feed' })
    await screen.findByText('Publicidad')
    act(() => triggerVisible())
    first.unmount()

    renderBanner({ placement: 'feed' })
    await screen.findByText('Publicidad')
    act(() => triggerVisible())

    expect(adsService.recordAdEvent).toHaveBeenCalledTimes(1)
  })

  it('el clic registra el evento y lleva al perfil del comercio', async () => {
    const user = userEvent.setup()
    renderBanner({ placement: 'feed' })

    await user.click(await screen.findByRole('link', { name: /Baño y corte -20%/ }))

    expect(adsService.recordAdEvent).toHaveBeenCalledWith(7, 'click', 'feed')
    expect(await screen.findByText('Perfil del comercio')).toBeInTheDocument()
  })

  it('permite denunciar el anuncio con un motivo', async () => {
    vi.mocked(adsService.flagAd).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderBanner({ placement: 'feed' })

    await user.click(await screen.findByRole('button', { name: 'Denunciar anuncio' }))
    await user.click(screen.getByRole('button', { name: 'Enviar denuncia' }))
    expect(await screen.findByText('Contanos el motivo de la denuncia.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Motivo de la denuncia'), 'Promete algo falso')
    await user.click(screen.getByRole('button', { name: 'Enviar denuncia' }))

    await waitFor(() => expect(adsService.flagAd).toHaveBeenCalledWith(7, 'Promete algo falso'))
    expect(await screen.findByText(/Recibimos tu denuncia/)).toBeInTheDocument()
  })

  it('no ofrece denunciar el anuncio propio', async () => {
    vi.mocked(adsService.getAdFor).mockResolvedValue({ ...anuncio, isOwn: true })
    renderBanner({ placement: 'feed' })

    await screen.findByText('Publicidad')
    expect(screen.queryByRole('button', { name: 'Denunciar anuncio' })).not.toBeInTheDocument()
  })

  it('al volver a montar pide el anuncio de nuevo (rota y no muestra uno dado de baja)', async () => {
    // cliente compartido con el gcTime por defecto: la cache sobrevive al desmontaje
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const first = renderBanner({ placement: 'feed' }, client)
    await screen.findByText('Publicidad')
    first.unmount()

    renderBanner({ placement: 'feed' }, client)

    await waitFor(() => expect(adsService.getAdFor).toHaveBeenCalledTimes(2))
  })

  it('una denuncia repetida se informa sin volver a ofrecer el formulario', async () => {
    vi.mocked(adsService.flagAd).mockRejectedValue(Object.assign(new Error('Ya denunciaste este anuncio'), { status: 409 }))
    const user = userEvent.setup()
    renderBanner({ placement: 'feed' })

    await user.click(await screen.findByRole('button', { name: 'Denunciar anuncio' }))
    await user.type(screen.getByLabelText('Motivo de la denuncia'), 'x')
    await user.click(screen.getByRole('button', { name: 'Enviar denuncia' }))

    expect(await screen.findByText('Ya denunciaste este anuncio.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Motivo de la denuncia')).not.toBeInTheDocument()
  })
})
