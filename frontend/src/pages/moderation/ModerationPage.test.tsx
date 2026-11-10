import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as moderationService from '@/services/moderation.service'
import * as adsService from '@/services/ads.service'
import ModerationPage from '@/pages/moderation/ModerationPage'
import type { ReportedAccountDTO, ReportFlagDTO } from '@/types/moderation.types'

vi.mock('@/services/moderation.service')
vi.mock('@/services/ads.service')

function flag(overrides: Partial<ReportFlagDTO> = {}): ReportFlagDTO {
  return {
    id: 1,
    reportId: 10,
    userId: 7,
    reason: 'Publicacion falsa',
    status: 'pending',
    createdAt: '2026-09-01T10:00:00.000Z',
    report: { id: 10, title: 'Perrito en Plaza de Mayo', status: 'published' },
    ...overrides,
  }
}

function cuenta(overrides: Partial<ReportedAccountDTO> = {}): ReportedAccountDTO {
  return {
    reportedUser: { id: 42, fullName: 'Juan Pérez' },
    reportCount: 2,
    severityCounts: { mild: 1, moderate: 0, severe: 1 },
    thresholdReached: false,
    resultingSeverity: null,
    lastReportedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  return render(
    <Wrapper>
      <MemoryRouter>
        <ModerationPage />
      </MemoryRouter>
    </Wrapper>
  )
}

describe('ModerationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adsService.listAdFlags).mockResolvedValue([])
    vi.mocked(moderationService.listReportedAccounts).mockResolvedValue([])
  })

  it('lista los flags pendientes de la cola', async () => {
    vi.mocked(moderationService.listReportFlags).mockResolvedValue([
      flag(),
      flag({ id: 2, reportId: 20, report: { id: 20, title: 'Gato perdido', status: 'published' } }),
    ])

    renderPage()

    expect(await screen.findByText('Perrito en Plaza de Mayo')).toBeInTheDocument()
    expect(screen.getByText('Gato perdido')).toBeInTheDocument()
  })

  it('avisa mientras carga la cola', () => {
    vi.mocked(moderationService.listReportFlags).mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getAllByRole('status', { name: 'Cargando' }).length).toBeGreaterThan(0)
  })

  it('muestra los anuncios denunciados y da de baja uno', async () => {
    vi.mocked(moderationService.listReportFlags).mockResolvedValue([])
    vi.mocked(adsService.listAdFlags).mockResolvedValue([
      {
        id: 5,
        adId: 7,
        userId: 9,
        reason: 'Promete algo falso',
        status: 'pending',
        createdAt: '2026-11-01T15:30:00.000Z',
        ad: {
          id: 7,
          title: 'Baño y corte -20%',
          body: 'Turnos',
          imageUrl: 'https://pub.r2.dev/ad.jpg',
          status: 'ACTIVE',
          business: { id: 3, name: 'Veterinaria Demo' },
        },
      },
    ])
    vi.mocked(adsService.resolveAdFlag).mockImplementation(async (id, action) => ({
      ...(await adsService.listAdFlags())[0],
      id,
      status: action === 'remove' ? 'removed' : 'dismissed',
    }))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Anuncios denunciados' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Dar de baja el anuncio' }))

    await waitFor(() => expect(adsService.resolveAdFlag).toHaveBeenCalledWith(5, 'remove'))
    expect(await screen.findByText('Anuncio dado de baja')).toBeInTheDocument()
  })

  it('avisa cuando la cola no se pudo cargar', async () => {
    vi.mocked(moderationService.listReportFlags).mockRejectedValue(new Error('403'))

    renderPage()

    expect(await screen.findByText('No se pudo cargar la cola de moderación')).toBeInTheDocument()
  })

  it.each([
    ['Ocultar reporte', 'accept', 'reviewed', 'Reporte ocultado y denuncia aceptada'],
    ['Descartar', 'dismiss', 'dismissed', 'Denuncia descartada, el reporte sigue publicado'],
  ] as const)('"%s" resuelve el flag y confirma la accion', async (boton, accion, status, mensaje) => {
    vi.mocked(moderationService.listReportFlags).mockResolvedValue([flag({ id: 42 })])
    vi.mocked(moderationService.resolveReportFlag).mockResolvedValue(flag({ id: 42, status }))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: boton }))

    await waitFor(() => expect(moderationService.resolveReportFlag).toHaveBeenCalledWith(42, accion))
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
  })

  it('muestra el error del backend cuando la resolucion falla', async () => {
    vi.mocked(moderationService.listReportFlags).mockResolvedValue([flag()])
    vi.mocked(moderationService.resolveReportFlag).mockRejectedValue(
      new Error('Este reporte de moderación ya fue revisado')
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Ocultar reporte' }))

    expect(
      await screen.findByText('Este reporte de moderación ya fue revisado')
    ).toBeInTheDocument()
  })

  describe('cuentas denunciadas', () => {
    beforeEach(() => {
      vi.mocked(moderationService.listReportFlags).mockResolvedValue([])
    })

    it('muestra cada cuenta con sus denuncias por gravedad', async () => {
      vi.mocked(moderationService.listReportedAccounts).mockResolvedValue([cuenta()])

      renderPage()

      const item = (await screen.findByText('Juan Pérez')).closest('li')!
      expect(item).toHaveTextContent('2 de 5 denuncias')
      expect(item).toHaveTextContent('Leve: 1')
      expect(item).toHaveTextContent('Media: 0')
      expect(item).toHaveTextContent('Fuerte: 1')
    })

    it('al llegar al umbral muestra la gravedad resultante', async () => {
      vi.mocked(moderationService.listReportedAccounts).mockResolvedValue([
        cuenta({
          reportedUser: { id: 43, fullName: null },
          reportCount: 5,
          severityCounts: { mild: 1, moderate: 2, severe: 2 },
          thresholdReached: true,
          resultingSeverity: 'severe',
        }),
      ])

      renderPage()

      const item = (await screen.findByText('Usuario #43')).closest('li')!
      expect(item).toHaveTextContent('Gravedad resultante: Fuerte')
    })

    it('avisa cuando no hay cuentas denunciadas', async () => {
      renderPage()

      expect(await screen.findByText('No hay cuentas denunciadas')).toBeInTheDocument()
    })
  })
})
