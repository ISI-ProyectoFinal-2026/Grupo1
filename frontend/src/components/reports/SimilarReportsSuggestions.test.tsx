import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SimilarReportsSuggestions from '@/components/reports/SimilarReportsSuggestions'
import { findSimilarReports } from '@/services/reports.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { ReportLocation, ReportType, SimilarReportDTO } from '@/types/report.types'

vi.mock('@/services/reports.service', () => ({ findSimilarReports: vi.fn() }))

const QUESTION = '¿Alguno de estos coincide con tu avistamiento?'
const LOCATION = { lat: -31.42, lng: -64.18 }

function similar(overrides: Partial<SimilarReportDTO> = {}): SimilarReportDTO {
  return {
    id: 21,
    title: 'Perro marrón encontrado',
    reportType: 'found',
    status: 'published',
    imageUrl: 'https://cdn/existente.jpg',
    distanceMeters: 350,
    similarity: null,
    isOwn: false,
    ...overrides,
  }
}

function DetalleFalso() {
  const { id } = useParams()
  return <p>Detalle del reporte {id}</p>
}

interface Props {
  reportType?: ReportType
  location?: ReportLocation
  imageUrl?: string
}

function renderSuggestions(props: Props = {}) {
  const { Wrapper } = createQueryWrapper()
  const element = (p: Props) => (
    <SimilarReportsSuggestions
      reportType={p.reportType ?? 'found'}
      location={'location' in p ? p.location : LOCATION}
      imageUrl={p.imageUrl}
    />
  )
  const ui = (p: Props) => (
    <Wrapper>
      <MemoryRouter initialEntries={['/reports/new']}>
        <Routes>
          <Route path='/reports/new' element={element(p)} />
          <Route path='/reports/:id' element={<DetalleFalso />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
  const utils = render(ui(props))
  return { ...utils, rerenderWith: (next: Props) => utils.rerender(ui(next)) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SimilarReportsSuggestions', () => {
  it('no consulta nada hasta que hay ubicacion', () => {
    renderSuggestions({ location: undefined })

    expect(findSimilarReports).not.toHaveBeenCalled()
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument()
  })

  it('muestra la pregunta y las sugerencias con distancia y similitud', async () => {
    vi.mocked(findSimilarReports).mockResolvedValue([
      similar({ id: 1, title: 'Muy parecido', distanceMeters: 1250, similarity: 0.874 }),
      similar({ id: 2, title: 'Sin foto', imageUrl: null, distanceMeters: 80 }),
    ])

    renderSuggestions({ imageUrl: 'https://cdn/foto.jpg' })

    expect(await screen.findByText(QUESTION)).toBeInTheDocument()
    expect(findSimilarReports).toHaveBeenCalledWith({
      reportType: 'found',
      location: LOCATION,
      imageUrl: 'https://cdn/foto.jpg',
    })
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Muy parecido')).toBeInTheDocument()
    expect(within(items[0]).getByText('a 1,3 km')).toBeInTheDocument()
    expect(within(items[0]).getByText('87 % de similitud')).toBeInTheDocument()
    expect(within(items[1]).getByText('a 80 m')).toBeInTheDocument()
    expect(within(items[1]).queryByText(/similitud/)).not.toBeInTheDocument()
  })

  it('no manda imageUrl cuando no hay foto', async () => {
    vi.mocked(findSimilarReports).mockResolvedValue([])

    renderSuggestions()

    await waitFor(() => expect(findSimilarReports).toHaveBeenCalled())
    expect(vi.mocked(findSimilarReports).mock.calls[0][0]).not.toHaveProperty('imageUrl')
  })

  it('marca los reportes resueltos', async () => {
    vi.mocked(findSimilarReports).mockResolvedValue([
      similar({ id: 1, status: 'resolved' }),
      similar({ id: 2, title: 'Activo' }),
    ])

    renderSuggestions()

    const items = await screen.findAllByRole('listitem')
    expect(within(items[0]).getByText('Resuelto')).toBeInTheDocument()
    expect(within(items[1]).queryByText('Resuelto')).not.toBeInTheDocument()
  })

  it('ofrece contactar al autor de un reporte ajeno y ver el propio', async () => {
    vi.mocked(findSimilarReports).mockResolvedValue([
      similar({ id: 1, isOwn: false }),
      similar({ id: 2, isOwn: true }),
    ])

    renderSuggestions()

    const items = await screen.findAllByRole('listitem')
    expect(
      within(items[0]).getByRole('button', { name: /Sí, es este.*Contactar al autor/ })
    ).toBeInTheDocument()
    expect(
      within(items[1]).getByRole('button', { name: /Sí, es este.*Ver mi reporte/ })
    ).toBeInTheDocument()
    expect(within(items[1]).queryByText('Contactar al autor')).not.toBeInTheDocument()
  })

  it('"Sí, es este" abre el reporte existente', async () => {
    vi.mocked(findSimilarReports).mockResolvedValue([similar({ id: 21 })])
    const user = userEvent.setup()

    renderSuggestions()

    await user.click(await screen.findByRole('button', { name: /Sí, es este/ }))

    expect(await screen.findByText('Detalle del reporte 21')).toBeInTheDocument()
  })

  it('vuelve a consultar cuando cambia la foto', async () => {
    vi.mocked(findSimilarReports).mockResolvedValue([similar()])

    const { rerenderWith } = renderSuggestions()
    await screen.findByText(QUESTION)

    rerenderWith({ imageUrl: 'https://cdn/nueva.jpg' })

    await waitFor(() =>
      expect(findSimilarReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ imageUrl: 'https://cdn/nueva.jpg' })
      )
    )
  })

  it('no muestra nada si no hay coincidencias', async () => {
    vi.mocked(findSimilarReports).mockResolvedValue([])

    renderSuggestions()

    await waitFor(() => expect(findSimilarReports).toHaveBeenCalled())
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument()
  })

  it('no muestra nada ni un error si la busqueda falla', async () => {
    vi.mocked(findSimilarReports).mockRejectedValue(new Error('caida'))

    renderSuggestions()

    await waitFor(() => expect(findSimilarReports).toHaveBeenCalled())
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
