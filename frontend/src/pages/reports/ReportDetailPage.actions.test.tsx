import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import { useAuthStore } from '@/stores/auth.store'
import * as reportsService from '@/services/reports.service'
import * as moderationService from '@/services/moderation.service'
import ReportDetailPage from '@/pages/reports/ReportDetailPage'
import type { ReportDTO, ReportStatus } from '@/types/report.types'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/reports.service')
vi.mock('@/services/chats.service')
vi.mock('@/services/moderation.service')

const DUENO_ID = 7
const OTRO_ID = 8

function usuario(id: number): AuthUser {
  return {
    id,
    email: `usuario${id}@patitas.test`,
    fullName: null,
    phone: null,
    role: 'usuario_regular',
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

function errorConStatus(message: string, status: number) {
  return Object.assign(new Error(message), { status })
}

function loguear(id: number) {
  useAuthStore.setState({ token: 'token', user: usuario(id) })
}

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={['/reports/5']}>
        <Routes>
          <Route path='/reports/:id' element={<ReportDetailPage />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

async function esperarDetalle() {
  await screen.findByRole('heading', { name: 'Perra perdida en Caballito' })
}

const cerrar = () => screen.queryByRole('button', { name: 'Cerrar reporte' })
const denunciar = () => screen.queryByRole('button', { name: 'Denunciar' })

describe('ReportDetailPage cerrar y denunciar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(reportsService.getReport).mockResolvedValue(reporte())
    vi.mocked(reportsService.getMatches).mockResolvedValue([])
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  describe('visibilidad', () => {
    it('el dueño de un reporte publicado puede cerrarlo pero no denunciarlo', async () => {
      loguear(DUENO_ID)
      renderPage()
      await esperarDetalle()

      expect(cerrar()).toBeInTheDocument()
      expect(denunciar()).not.toBeInTheDocument()
    })

    it.each<ReportStatus>(['resolved', 'pending', 'rejected'])(
      'el dueño no ve Cerrar reporte si el reporte está %s',
      async (status) => {
        vi.mocked(reportsService.getReport).mockResolvedValue(reporte({ status }))
        loguear(DUENO_ID)
        renderPage()
        await esperarDetalle()

        expect(cerrar()).not.toBeInTheDocument()
      }
    )

    it('otro usuario logueado puede denunciar un reporte publicado pero no cerrarlo', async () => {
      loguear(OTRO_ID)
      renderPage()
      await esperarDetalle()

      expect(denunciar()).toBeInTheDocument()
      expect(cerrar()).not.toBeInTheDocument()
    })

    it.each<ReportStatus>(['resolved', 'pending', 'rejected'])(
      'nadie ve Denunciar si el reporte está %s',
      async (status) => {
        vi.mocked(reportsService.getReport).mockResolvedValue(reporte({ status }))
        loguear(OTRO_ID)
        renderPage()
        await esperarDetalle()

        expect(denunciar()).not.toBeInTheDocument()
      }
    )

    it('sin sesión no se ve ninguna de las dos acciones', async () => {
      renderPage()
      await esperarDetalle()

      expect(denunciar()).not.toBeInTheDocument()
      expect(cerrar()).not.toBeInTheDocument()
    })
  })

  describe('cerrar reporte', () => {
    it('al confirmar el cierre el reporte queda resuelto', async () => {
      loguear(DUENO_ID)
      vi.mocked(reportsService.closeReport).mockResolvedValue(reporte({ status: 'resolved' }))
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Cerrar reporte' }))
      await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

      expect(await screen.findByText('resolved')).toBeInTheDocument()
      expect(reportsService.closeReport).toHaveBeenCalledWith(5)
      expect(cerrar()).not.toBeInTheDocument()
    })

    it('si ya estaba cerrado (409) lo avisa', async () => {
      loguear(DUENO_ID)
      vi.mocked(reportsService.closeReport).mockRejectedValue(
        errorConStatus('El reporte ya está resuelto', 409)
      )
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Cerrar reporte' }))
      await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Este reporte ya estaba cerrado.')
    })
  })

  describe('denunciar', () => {
    it('envía la denuncia, la confirma y deshabilita el botón', async () => {
      loguear(OTRO_ID)
      vi.mocked(moderationService.createReportFlag).mockResolvedValue({
        id: 3,
        reportId: 5,
        userId: OTRO_ID,
        reason: 'Es una estafa',
        status: 'pending',
        createdAt: '2026-09-20T10:00:00.000Z',
      })
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Denunciar' }))
      await user.type(screen.getByLabelText('Motivo de la denuncia'), 'Es una estafa')
      await user.click(screen.getByRole('button', { name: 'Enviar denuncia' }))

      expect(await screen.findByRole('status')).toHaveTextContent('Recibimos tu denuncia')
      expect(moderationService.createReportFlag).toHaveBeenCalledWith(5, 'Es una estafa')
      expect(denunciar()).toBeDisabled()
    })

    it('no envía la denuncia sin motivo', async () => {
      loguear(OTRO_ID)
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Denunciar' }))
      await user.click(screen.getByRole('button', { name: 'Enviar denuncia' }))

      expect(screen.getByText('Contanos el motivo de la denuncia.')).toBeInTheDocument()
      expect(moderationService.createReportFlag).not.toHaveBeenCalled()
    })

    it('si ya lo había denunciado (409) lo avisa y deshabilita el botón', async () => {
      loguear(OTRO_ID)
      vi.mocked(moderationService.createReportFlag).mockRejectedValue(
        errorConStatus('Ya reportaste esta publicación', 409)
      )
      const user = userEvent.setup()
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Denunciar' }))
      await user.type(screen.getByLabelText('Motivo de la denuncia'), 'Es una estafa')
      await user.click(screen.getByRole('button', { name: 'Enviar denuncia' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Ya denunciaste este reporte.')
      expect(denunciar()).toBeDisabled()
    })
  })
})
