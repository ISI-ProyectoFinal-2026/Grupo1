import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyReportsPage from '@/pages/reports/MyReportsPage'
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
    title: 'Perro perdido en Nueva Córdoba',
    description: 'Collar rojo, responde a Pepe',
    imageUrl: 'https://cdn/pepe.jpg',
    extraImageUrls: [],
    customFlyerUrl: null,
    showPhoneOnFlyer: false,
    eventDate: null,
    locationAddress: 'Nueva Córdoba',
    location: { lat: -31.42, lng: -64.18 },
    tag: { label: 'PERDIDO', color: '#C4342B' },
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    publishedAt: '2026-09-20T10:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  render(
    <Wrapper>
      <MemoryRouter initialEntries={['/reports/mine']}>
        <Routes>
          <Route path='/reports/mine' element={<MyReportsPage />} />
          <Route path='/reports/new' element={<div>pagina crear reporte</div>} />
          <Route path='/reports/:id' element={<div>pagina detalle reporte</div>} />
          <Route path='/reports/:id/edit' element={<div>pagina editar reporte</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MyReportsPage: listado', () => {
  it('muestra cada reporte propio con su estado', async () => {
    vi.mocked(reportsService.listMyReports).mockResolvedValue([
      reporte({ id: 1, title: 'Pendiente de moderar', status: 'pending' }),
      reporte({ id: 2, title: 'Ya publicado', status: 'published' }),
      reporte({ id: 3, title: 'Rechazado por moderación', status: 'rejected' }),
      reporte({ id: 4, title: 'Caso cerrado', status: 'resolved' }),
      reporte({ id: 6, title: 'Denunciado', status: 'hidden' }),
    ])
    renderPage()

    const casos: [string, string][] = [
      ['Pendiente de moderar', 'Pendiente'],
      ['Ya publicado', 'Publicado'],
      ['Rechazado por moderación', 'Rechazado'],
      ['Denunciado', 'Oculto por denuncias'],
      ['Caso cerrado', 'Resuelto'],
    ]
    for (const [titulo, estado] of casos) {
      const card = (await screen.findByRole('heading', { name: titulo })).closest('li')!
      expect(within(card).getByText(estado)).toBeInTheDocument()
    }
  })

  it('muestra un estado vacío con acceso a crear un reporte', async () => {
    vi.mocked(reportsService.listMyReports).mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('Todavía no publicaste ningún reporte.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Nuevo reporte' }))
    expect(screen.getByText('pagina crear reporte')).toBeInTheDocument()
  })

  it('muestra un error si no se pudo cargar el listado', async () => {
    vi.mocked(reportsService.listMyReports).mockRejectedValue(new Error('boom'))
    renderPage()

    expect(await screen.findByText('No se pudieron cargar tus reportes')).toBeInTheDocument()
  })
})

describe('MyReportsPage: acciones', () => {
  it('lleva al detalle del reporte', async () => {
    vi.mocked(reportsService.listMyReports).mockResolvedValue([reporte()])
    renderPage()

    await userEvent.click(await screen.findByRole('link', { name: 'Ver Perro perdido en Nueva Córdoba' }))
    expect(screen.getByText('pagina detalle reporte')).toBeInTheDocument()
  })

  it('lleva a editar el reporte', async () => {
    vi.mocked(reportsService.listMyReports).mockResolvedValue([reporte({ status: 'rejected' })])
    renderPage()

    await userEvent.click(await screen.findByRole('link', { name: 'Editar Perro perdido en Nueva Córdoba' }))
    expect(screen.getByText('pagina editar reporte')).toBeInTheDocument()
  })

  it('elimina el reporte tras confirmar y lo saca de la lista', async () => {
    vi.mocked(reportsService.listMyReports)
      .mockResolvedValueOnce([reporte()])
      .mockResolvedValueOnce([])
    vi.mocked(reportsService.deleteReport).mockResolvedValue()
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar reporte' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))

    expect(reportsService.deleteReport).toHaveBeenCalledWith(5)
    expect(await screen.findByText('Todavía no publicaste ningún reporte.')).toBeInTheDocument()
  })

  it('no elimina si se cancela la confirmación', async () => {
    vi.mocked(reportsService.listMyReports).mockResolvedValue([reporte()])
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar reporte' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Eliminar reporte' })).toBeInTheDocument())
    expect(reportsService.deleteReport).not.toHaveBeenCalled()
  })
})
