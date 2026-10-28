import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import { useAuthStore } from '@/stores/auth.store'
import * as reportsService from '@/services/reports.service'
import EditReportPage from '@/pages/reports/EditReportPage'
import type { ReportDTO } from '@/types/report.types'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/reports.service')

// Leaflet, geolocalizacion y subida a R2 no hacen falta para probar la pagina.
vi.mock('@/components/reports/LocationPicker', () => ({ default: () => null }))
vi.mock('@/components/reports/ImageUploader', () => ({ default: () => <p>uploader de fotos</p> }))

const DUENO_ID = 7

function usuario(id: number): AuthUser {
  return {
    id,
    email: `usuario${id}@patitas.test`,
    fullName: null,
    phone: null,
    role: 'usuario_regular',
    emailVerifiedAt: '2026-09-01T10:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function reporte(overrides: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: 5,
    userId: DUENO_ID,
    petId: null,
    reportType: 'lost',
    status: 'published',
    title: 'Perra perdida en Caballito',
    description: 'Collar rojo',
    imageUrl: 'https://cdn/actual.jpg',
    customFlyerUrl: null,
    locationAddress: 'Caballito, CABA',
    location: { lat: -34.61, lng: -58.44 },
    tag: { label: 'PERDIDO', color: '#EF4444' },
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '2026-09-19T10:00:00.000Z',
    publishedAt: '2026-09-19T10:05:00.000Z',
    ...overrides,
  }
}

function DetalleFalso() {
  const state = useLocation().state as { message?: string } | null
  return (
    <div>
      <p>detalle del reporte</p>
      <p>{state?.message}</p>
    </div>
  )
}

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={['/reports/5/edit']}>
        <Routes>
          <Route path='/reports/:id/edit' element={<EditReportPage />} />
          <Route path='/reports/:id' element={<DetalleFalso />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ token: 'token', user: usuario(DUENO_ID) })
})

afterEach(() => {
  useAuthStore.getState().logout()
})

describe('EditReportPage', () => {
  it('precarga el reporte del dueño en el formulario', async () => {
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte())
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Editar reporte' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título *')).toHaveValue('Perra perdida en Caballito')
    expect(screen.getByLabelText('Descripción')).toHaveValue('Collar rojo')
    expect(reportsService.getReport).toHaveBeenCalledWith(5)
  })

  it('guarda con PUT y vuelve al detalle con el aviso de exito', async () => {
    const user = userEvent.setup()
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte())
    vi.mocked(reportsService.updateReport).mockResolvedValue(
      reporte({ title: 'Perra encontrada en Caballito' })
    )
    renderPage()

    const titulo = await screen.findByLabelText('Título *')
    await user.clear(titulo)
    await user.type(titulo, 'Perra encontrada en Caballito')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('detalle del reporte')).toBeInTheDocument()
    expect(screen.getByText('Reporte actualizado')).toBeInTheDocument()
    expect(reportsService.updateReport).toHaveBeenCalledWith(5, {
      reportType: 'lost',
      title: 'Perra encontrada en Caballito',
      description: 'Collar rojo',
      imageUrl: 'https://cdn/actual.jpg',
      location: { lat: -34.61, lng: -58.44 },
      locationAddress: 'Caballito, CABA',
    })
  })

  it('si el guardado falla se queda en el formulario con el error', async () => {
    const user = userEvent.setup()
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte())
    vi.mocked(reportsService.updateReport).mockRejectedValue(new Error('Reporte no encontrado'))
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Reporte no encontrado')).toBeInTheDocument()
    expect(screen.queryByText('detalle del reporte')).not.toBeInTheDocument()
  })

  it('no deja editar a quien no es el dueño', async () => {
    useAuthStore.setState({ token: 'token', user: usuario(8) })
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte())
    renderPage()

    expect(
      await screen.findByText('No tenés permiso para editar este reporte.')
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Título *')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al reporte' })).toHaveAttribute(
      'href',
      '/reports/5'
    )
  })

  it('en un reporte resuelto no ofrece cambiar la foto', async () => {
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte({ status: 'resolved' }))
    renderPage()

    expect(
      await screen.findByText(/La foto de un reporte resuelto no se puede cambiar/)
    ).toBeInTheDocument()
    expect(screen.queryByText('uploader de fotos')).not.toBeInTheDocument()
  })

  it('precarga un reporte sin datos opcionales', async () => {
    vi.mocked(reportsService.getReport).mockResolvedValue(
      reporte({ description: null, imageUrl: null, locationAddress: null, location: null })
    )
    renderPage()

    expect(await screen.findByLabelText('Descripción')).toHaveValue('')
    expect(screen.queryByAltText('Foto actual')).not.toBeInTheDocument()
  })

  it('muestra un error si el reporte no carga', async () => {
    vi.mocked(reportsService.getReport).mockRejectedValue(new Error('Reporte no encontrado'))
    renderPage()

    expect(await screen.findByText('Error al cargar el reporte')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Volver a reportes' })).toHaveAttribute(
        'href',
        '/reports'
      )
    )
  })
})
