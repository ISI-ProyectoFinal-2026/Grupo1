import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import InactivityWarningBanner from '@/components/reports/InactivityWarningBanner'
import { createQueryWrapper } from '@/test/query-wrapper'
import { useAuthStore } from '@/stores/auth.store'
import * as reportsService from '@/services/reports.service'
import type { InactivityWarningDTO, ReportDTO, ReportStatus } from '@/types/report.types'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/reports.service')

const OWNER_ID = 7

function loguear(id: number) {
  useAuthStore.setState({ token: 't', user: { id } as AuthUser })
}

function aviso(day: 30 | 37 | null, pending = true): InactivityWarningDTO {
  return { pending, warnedAt: pending ? '2026-10-01T10:00:00.000Z' : null, day }
}

function errorConStatus(status: number) {
  return Object.assign(new Error('error'), { status })
}

function renderizar(status: ReportStatus = 'published') {
  const { Wrapper } = createQueryWrapper()
  return render(<InactivityWarningBanner report={{ id: 5, userId: OWNER_ID, status } as ReportDTO} />, {
    wrapper: Wrapper,
  })
}

describe('InactivityWarningBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loguear(OWNER_ID)
  })

  afterEach(() => useAuthStore.setState({ token: null, user: null }))

  it('el dueño con aviso pendiente ve el aviso y las dos acciones', async () => {
    vi.mocked(reportsService.getInactivityWarning).mockResolvedValue(aviso(30))
    renderizar()

    expect(await screen.findByRole('button', { name: 'Caso resuelto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seguir mostrando' })).toBeInTheDocument()
    expect(reportsService.getInactivityWarning).toHaveBeenCalledWith(5)
  })

  it('dia 30: avisa que se cerrara en unos dias', async () => {
    vi.mocked(reportsService.getInactivityWarning).mockResolvedValue(aviso(30))
    renderizar()

    expect(await screen.findByText(/30 días sin actividad.*en unos días/)).toBeInTheDocument()
  })

  it('dia 37: avisa que se cerrara mañana', async () => {
    vi.mocked(reportsService.getInactivityWarning).mockResolvedValue(aviso(37))
    renderizar()

    expect(await screen.findByText(/37 días sin actividad.*mañana/)).toBeInTheDocument()
  })

  it('sin aviso pendiente no muestra nada', async () => {
    vi.mocked(reportsService.getInactivityWarning).mockResolvedValue(aviso(null, false))
    renderizar()

    await waitFor(() => expect(reportsService.getInactivityWarning).toHaveBeenCalled())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('un no dueño no consulta ni muestra el aviso', () => {
    loguear(99)
    renderizar()

    expect(reportsService.getInactivityWarning).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('un visitante no consulta el aviso', () => {
    useAuthStore.setState({ token: null, user: null })
    renderizar()

    expect(reportsService.getInactivityWarning).not.toHaveBeenCalled()
  })

  it.each<ReportStatus>(['hidden', 'resolved', 'pending'])(
    'un reporte %s no consulta el aviso',
    (status) => {
      renderizar(status)

      expect(reportsService.getInactivityWarning).not.toHaveBeenCalled()
    }
  )

  it.each([401, 403, 404])('ante un %i no muestra aviso ni error', async (status) => {
    vi.mocked(reportsService.getInactivityWarning).mockRejectedValue(errorConStatus(status))
    renderizar()

    await waitFor(() => expect(reportsService.getInactivityWarning).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('Seguir mostrando llama al endpoint, confirma y el aviso desaparece', async () => {
    vi.mocked(reportsService.getInactivityWarning)
      .mockResolvedValueOnce(aviso(37))
      .mockResolvedValue(aviso(null, false))
    vi.mocked(reportsService.keepReportActive).mockResolvedValue({} as ReportDTO)
    renderizar()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Seguir mostrando' }))

    expect(reportsService.keepReportActive).toHaveBeenCalledWith(5)
    expect(await screen.findByRole('status')).toHaveTextContent('Tu reporte sigue publicado.')
    await waitFor(() =>
      expect(vi.mocked(reportsService.getInactivityWarning).mock.calls.length).toBeGreaterThan(1)
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText(/días sin actividad/)).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('Caso resuelto llama al endpoint de cierre', async () => {
    vi.mocked(reportsService.getInactivityWarning).mockResolvedValue(aviso(30))
    vi.mocked(reportsService.closeReport).mockResolvedValue({} as ReportDTO)
    renderizar()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Caso resuelto' }))

    expect(reportsService.closeReport).toHaveBeenCalledWith(5)
    expect(await screen.findByRole('status')).toHaveTextContent('Cerraste el reporte.')
  })
})
