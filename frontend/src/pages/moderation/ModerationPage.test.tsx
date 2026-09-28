import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as moderationService from '@/services/moderation.service'
import ModerationPage from '@/pages/moderation/ModerationPage'
import type { ReportFlagDTO } from '@/types/moderation.types'

vi.mock('@/services/moderation.service')

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

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
  })

  it('avisa cuando la cola no se pudo cargar', async () => {
    vi.mocked(moderationService.listReportFlags).mockRejectedValue(new Error('403'))

    renderPage()

    expect(await screen.findByText('No se pudo cargar la cola de moderación')).toBeInTheDocument()
  })

  it('resuelve un flag y confirma la accion', async () => {
    vi.mocked(moderationService.listReportFlags).mockResolvedValue([flag({ id: 42 })])
    vi.mocked(moderationService.resolveReportFlag).mockResolvedValue(
      flag({ id: 42, status: 'reviewed' })
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Resolver y ocultar' }))

    await waitFor(() => expect(moderationService.resolveReportFlag).toHaveBeenCalledWith(42))
    expect(await screen.findByText('Reporte ocultado y denuncia resuelta')).toBeInTheDocument()
  })

  it('muestra el error del backend cuando la resolucion falla', async () => {
    vi.mocked(moderationService.listReportFlags).mockResolvedValue([flag()])
    vi.mocked(moderationService.resolveReportFlag).mockRejectedValue(
      new Error('Este reporte de moderación ya fue revisado')
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Resolver y ocultar' }))

    expect(
      await screen.findByText('Este reporte de moderación ya fue revisado')
    ).toBeInTheDocument()
  })
})
