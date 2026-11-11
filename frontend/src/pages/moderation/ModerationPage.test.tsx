import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as moderationService from '@/services/moderation.service'
import * as adsService from '@/services/ads.service'
import ModerationPage from '@/pages/moderation/ModerationPage'
import type { ReportedAccountDTO, ReportFlagGroupDTO } from '@/types/moderation.types'

vi.mock('@/services/moderation.service')
vi.mock('@/services/ads.service')

function grupo(overrides: Partial<ReportFlagGroupDTO> = {}): ReportFlagGroupDTO {
  return {
    report: {
      id: 10,
      title: 'Perrito en Plaza de Mayo',
      status: 'published',
      reportType: 'lost',
      imageUrl: null,
      description: null,
    },
    flagCount: 1,
    reasonCounts: { spam: 1 },
    otherDetails: [],
    lastFlaggedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

function grupoOculto(overrides: Partial<ReportFlagGroupDTO> = {}): ReportFlagGroupDTO {
  return grupo({
    report: { ...grupo().report, id: 20, title: 'Gato perdido', status: 'hidden' },
    flagCount: 5,
    reasonCounts: { false_info: 5 },
    ...overrides,
  })
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

  it('lista los reportes denunciados de la cola agrupada', async () => {
    vi.mocked(moderationService.listReportFlagGroups).mockResolvedValue([grupoOculto(), grupo()])

    renderPage()

    expect(await screen.findByText('Perrito en Plaza de Mayo')).toBeInTheDocument()
    expect(screen.getByText('Gato perdido')).toBeInTheDocument()
    expect(screen.getByText('Información falsa: 5')).toBeInTheDocument()
  })

  it('avisa mientras carga la cola', () => {
    vi.mocked(moderationService.listReportFlagGroups).mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getAllByRole('status', { name: 'Cargando' }).length).toBeGreaterThan(0)
  })

  it('muestra los anuncios denunciados y da de baja uno', async () => {
    vi.mocked(moderationService.listReportFlagGroups).mockResolvedValue([])
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
    vi.mocked(moderationService.listReportFlagGroups).mockRejectedValue(new Error('403'))

    renderPage()

    expect(await screen.findByText('No se pudo cargar la cola de moderación')).toBeInTheDocument()
  })

  it.each([
    ['Ocultar', 'hide', grupo(), 'published', 'Reporte ocultado'],
    ['Descartar', 'dismiss', grupo(), 'published', 'Denuncias descartadas, el reporte sigue publicado'],
    ['Restaurar', 'restore', grupoOculto(), 'published', 'Reporte restaurado, vuelve a estar publicado'],
    ['Confirmar ocultamiento', 'confirm', grupoOculto(), 'hidden', 'Ocultamiento confirmado'],
  ] as const)('"%s" aplica %s sobre el reporte y confirma la accion', async (boton, accion, item, status, mensaje) => {
    vi.mocked(moderationService.listReportFlagGroups).mockResolvedValue([item])
    vi.mocked(moderationService.moderateReport).mockResolvedValue({ id: item.report.id, status })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: boton }))

    await waitFor(() => expect(moderationService.moderateReport).toHaveBeenCalledWith(item.report.id, accion))
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
  })

  it('refresca la cola despues de una accion', async () => {
    vi.mocked(moderationService.listReportFlagGroups)
      .mockResolvedValueOnce([grupo()])
      .mockResolvedValue([])
    vi.mocked(moderationService.moderateReport).mockResolvedValue({ id: 10, status: 'hidden' })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Ocultar' }))

    await waitFor(() => expect(screen.queryByText('Perrito en Plaza de Mayo')).not.toBeInTheDocument())
    expect(moderationService.listReportFlagGroups).toHaveBeenCalledTimes(2)
  })

  it('muestra el error del backend cuando otro moderador ya resolvio el reporte', async () => {
    vi.mocked(moderationService.listReportFlagGroups).mockResolvedValue([grupo()])
    vi.mocked(moderationService.moderateReport).mockRejectedValue(new Error('Este reporte ya fue revisado'))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Ocultar' }))

    expect(await screen.findByText('Este reporte ya fue revisado')).toBeInTheDocument()
  })

  describe('cuentas denunciadas', () => {
    beforeEach(() => {
      vi.mocked(moderationService.listReportFlagGroups).mockResolvedValue([])
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

    it('avisa que las cuentas sancionadas pasan a la cola de sanciones', async () => {
      renderPage()

      const note = await screen.findByRole('note')
      expect(note).toHaveTextContent('Cuando una cuenta llega a 5 denuncias sale de esta lista')
      expect(screen.getByRole('link', { name: 'Sanciones pendientes' })).toHaveAttribute(
        'href',
        '/admin/sanctions'
      )
    })
  })
})
