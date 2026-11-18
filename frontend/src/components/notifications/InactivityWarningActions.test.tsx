import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InactivityWarningActions from '@/components/notifications/InactivityWarningActions'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as reportsService from '@/services/reports.service'
import type { ReportDTO } from '@/types/report.types'

vi.mock('@/services/reports.service')

function renderizar() {
  const { Wrapper } = createQueryWrapper()
  return render(<InactivityWarningActions reportId={5} />, { wrapper: Wrapper })
}

describe('InactivityWarningActions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra la pregunta y las dos acciones', () => {
    renderizar()

    expect(screen.getByText('¿Querés seguir mostrando tu reporte?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Caso resuelto' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Seguir mostrando' })).toBeEnabled()
  })

  it('Seguir mostrando llama al servicio y confirma', async () => {
    vi.mocked(reportsService.keepReportActive).mockResolvedValue({} as ReportDTO)
    renderizar()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Seguir mostrando' }))

    expect(reportsService.keepReportActive).toHaveBeenCalledWith(5)
    expect(await screen.findByRole('status')).toHaveTextContent('Tu reporte sigue publicado.')
    expect(screen.queryByRole('button', { name: 'Seguir mostrando' })).not.toBeInTheDocument()
  })

  it('Caso resuelto cierra el reporte y confirma', async () => {
    vi.mocked(reportsService.closeReport).mockResolvedValue({} as ReportDTO)
    renderizar()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Caso resuelto' }))

    expect(reportsService.closeReport).toHaveBeenCalledWith(5)
    expect(await screen.findByRole('status')).toHaveTextContent('Cerraste el reporte.')
  })

  it('deshabilita los botones mientras la accion esta pendiente', async () => {
    vi.mocked(reportsService.keepReportActive).mockReturnValue(new Promise(() => {}))
    renderizar()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Seguir mostrando' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Caso resuelto' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Seguir mostrando' })).toBeDisabled()
  })

  it('ante un 409 oculta las acciones y avisa', async () => {
    vi.mocked(reportsService.keepReportActive).mockRejectedValue(
      Object.assign(new Error('conflicto'), { status: 409 })
    )
    renderizar()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Seguir mostrando' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Este reporte ya no está publicado.')
    expect(screen.queryByRole('button', { name: 'Caso resuelto' })).not.toBeInTheDocument()
  })

  it('ante otro error muestra el mensaje y deja reintentar', async () => {
    vi.mocked(reportsService.closeReport).mockRejectedValue(
      Object.assign(new Error('Sin permiso'), { status: 403 })
    )
    renderizar()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Caso resuelto' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin permiso')

    expect(screen.getByRole('button', { name: 'Caso resuelto' })).toBeEnabled()
  })
})
