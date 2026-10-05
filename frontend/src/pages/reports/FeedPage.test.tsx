import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FeedPage from '@/pages/reports/FeedPage'
import * as reportsService from '@/services/reports.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { ReportDTO } from '@/types/report.types'

vi.mock('@/services/reports.service')

function reporte(overrides: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: 5,
    userId: 7,
    petId: null,
    reportType: 'lost',
    status: 'published',
    title: 'Perra perdida en Caballito',
    description: null,
    imageUrl: null,
    customFlyerUrl: null,
    locationAddress: 'Caballito, CABA',
    location: null,
    tag: { label: 'PERDIDO', color: '#EF4444' },
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '2026-09-19T10:00:00.000Z',
    publishedAt: '2026-09-19T10:05:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>
    </Wrapper>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(reportsService.listReports).mockResolvedValue([reporte()])
})

describe('FeedPage: listado', () => {
  it('pide solo los reportes publicados y los muestra', async () => {
    renderPage()

    expect(await screen.findByText('Perra perdida en Caballito')).toBeInTheDocument()
    expect(reportsService.listReports).toHaveBeenCalledWith({
      status: 'published',
      type: undefined,
      zone: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    })
    expect(screen.getByRole('link', { name: /Perra perdida en Caballito/ })).toHaveAttribute(
      'href',
      '/reports/5'
    )
  })

  it('ordena los reportes del mas nuevo al mas viejo', async () => {
    vi.mocked(reportsService.listReports).mockResolvedValue([
      reporte({ id: 1, title: 'Viejo', createdAt: '2026-09-01T10:00:00.000Z' }),
      reporte({ id: 2, title: 'Nuevo', createdAt: '2026-09-20T10:00:00.000Z' }),
    ])

    renderPage()

    await screen.findByText('Nuevo')
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titulos.indexOf('Nuevo')).toBeLessThan(titulos.indexOf('Viejo'))
  })

  it('tiene un link para crear un reporte', async () => {
    renderPage()

    expect(await screen.findByRole('link', { name: '+ Crear Reporte' })).toHaveAttribute(
      'href',
      '/reports/new'
    )
  })

  it('muestra el spinner mientras carga', () => {
    vi.mocked(reportsService.listReports).mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
  })

  it('avisa cuando no hay reportes', async () => {
    vi.mocked(reportsService.listReports).mockResolvedValue([])

    renderPage()

    expect(
      await screen.findByText('No hay reportes que coincidan con tus filtros')
    ).toBeInTheDocument()
  })

  it('muestra el error si falla la carga', async () => {
    vi.mocked(reportsService.listReports).mockRejectedValue(new Error('boom'))

    renderPage()

    expect(await screen.findByText(/Error al cargar reportes/)).toBeInTheDocument()
    expect(screen.queryByText('Perra perdida en Caballito')).not.toBeInTheDocument()
  })
})

describe('FeedPage: filtros', () => {
  it('vuelve a pedir los reportes con el tipo elegido', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Perra perdida en Caballito')

    await user.selectOptions(screen.getByLabelText('Tipo'), 'found')

    await waitFor(() =>
      expect(reportsService.listReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'published', type: 'found' })
      )
    )
  })

  it('filtra por zona y rango de fechas', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Perra perdida en Caballito')

    await user.type(screen.getByLabelText('Zona'), 'Palermo')
    await user.type(screen.getByLabelText('Desde'), '2026-09-01')
    await user.type(screen.getByLabelText('Hasta'), '2026-09-30')

    await waitFor(() =>
      expect(reportsService.listReports).toHaveBeenLastCalledWith({
        status: 'published',
        type: undefined,
        zone: 'Palermo',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
      })
    )
  })

  it('al volver a "Todos" deja de filtrar por tipo', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Perra perdida en Caballito')

    await user.selectOptions(screen.getByLabelText('Tipo'), 'lost')
    await user.selectOptions(screen.getByLabelText('Tipo'), '')

    await waitFor(() =>
      expect(reportsService.listReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: undefined })
      )
    )
  })
})

describe('FeedPage: vista de mapa', () => {
  it('avisa que no hay ubicaciones si ningun reporte tiene coordenadas', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Perra perdida en Caballito')

    await user.click(screen.getByRole('button', { name: /Mapa/ }))

    expect(screen.getByText('No hay reportes con ubicación para mostrar')).toBeInTheDocument()
    expect(screen.queryByText('Perra perdida en Caballito')).not.toBeInTheDocument()
  })

  it('vuelve a la lista al elegir "Lista"', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Perra perdida en Caballito')

    await user.click(screen.getByRole('button', { name: /Mapa/ }))
    await user.click(screen.getByRole('button', { name: /Lista/ }))

    expect(screen.getByText('Perra perdida en Caballito')).toBeInTheDocument()
  })
})
