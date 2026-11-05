import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SanctionQueuePage from '@/pages/admin/SanctionQueuePage'
import * as adminService from '@/services/admin.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { SanctionQueueItem } from '@/types/admin.types'
import type { AuthUser } from '@/types/auth'

vi.mock('@/services/admin.service')

const YO: AuthUser = {
  id: 1,
  email: 'admin@example.com',
  fullName: 'Admin Root',
  phone: null,
  role: 'admin',
  emailVerifiedAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

function caso(overrides: Partial<SanctionQueueItem> = {}): SanctionQueueItem {
  return {
    id: 12,
    account: { id: 4, fullName: 'Ana Pérez', email: 'ana@example.com' },
    role: 'moderador',
    kind: 'temporary',
    status: 'pending_review',
    severity: 'moderate',
    severityCounts: { mild: 1, moderate: 3, severe: 1 },
    reportDates: ['2026-11-03T12:00:00.000Z', '2026-11-04T12:00:00.000Z'],
    ...overrides,
  }
}

function errorConCodigo(message: string, code: string, status: number) {
  return Object.assign(new Error(message), { code, status })
}

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  render(
    <Wrapper>
      <SanctionQueuePage />
    </Wrapper>
  )
}

async function decidir(
  user: ReturnType<typeof userEvent.setup>,
  accion: 'Confirmar' | 'Revertir',
  motivo: string
) {
  await user.click(await screen.findByRole('button', { name: accion }))
  const dialogo = screen.getByRole('alertdialog')
  await user.type(within(dialogo).getByLabelText('Motivo'), motivo)
  await user.click(within(dialogo).getByRole('button', { name: accion }))
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ token: 'token', user: YO })
  vi.mocked(adminService.listPendingSanctions).mockResolvedValue({ items: [caso()] })
})

afterEach(() => {
  useAuthStore.getState().logout()
})

describe('SanctionQueuePage', () => {
  it('muestra cuenta, conteo por gravedad y fechas, sin denunciantes', async () => {
    renderPage()

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByText('Leves: 1')).toBeInTheDocument()
    expect(screen.getByText('Medias: 3')).toBeInTheDocument()
    expect(screen.getByText('Fuertes: 1')).toBeInTheDocument()
    expect(screen.getByText(/3 de noviembre de 2026/)).toBeInTheDocument()
    expect(screen.getByText(/4 de noviembre de 2026/)).toBeInTheDocument()
  })

  it('muestra un vacío cuando no hay casos', async () => {
    vi.mocked(adminService.listPendingSanctions).mockResolvedValue({ items: [] })
    renderPage()

    expect(await screen.findByText('No hay casos pendientes.')).toBeInTheDocument()
  })

  it('no renderiza nada para quien no es admin', () => {
    useAuthStore.setState({ token: 'token', user: { ...YO, role: 'moderador' } })
    renderPage()

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(adminService.listPendingSanctions).not.toHaveBeenCalled()
  })

  it('confirma con el motivo escrito en el diálogo', async () => {
    vi.mocked(adminService.confirmSanction).mockResolvedValue({
      id: 12,
      status: 'active',
      kind: 'temporary',
      endsAt: null,
    })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))

    const dialogo = screen.getByRole('alertdialog')
    const aceptar = within(dialogo).getByRole('button', { name: 'Confirmar' })
    expect(aceptar).toBeDisabled()
    await user.type(within(dialogo).getByLabelText('Motivo'), 'Evidencia suficiente')
    await user.click(aceptar)

    await waitFor(() =>
      expect(adminService.confirmSanction).toHaveBeenCalledWith(12, 'Evidencia suficiente')
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('revierte con el motivo y el diálogo se puede cancelar', async () => {
    vi.mocked(adminService.revertSanction).mockResolvedValue({
      id: 12,
      status: 'dismissed',
      kind: 'temporary',
      endsAt: null,
    })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Revertir' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' })
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await decidir(user, 'Revertir', 'Denuncias infundadas')

    await waitFor(() =>
      expect(adminService.revertSanction).toHaveBeenCalledWith(12, 'Denuncias infundadas')
    )
  })

  it.each([
    ['SANCTION_ALREADY_DECIDED', 409, 'Otro administrador ya decidió este caso.'],
    ['LAST_ADMIN', 409, 'No se puede sancionar al último administrador activo.'],
    ['SELF_SANCTION_DECISION', 403, 'No podés decidir sobre tu propia sanción.'],
  ])('mapea el código %s a un mensaje', async (code, status, mensaje) => {
    vi.mocked(adminService.confirmSanction).mockRejectedValue(
      errorConCodigo('mensaje crudo del servidor', code, status)
    )
    const user = userEvent.setup()
    renderPage()
    await decidir(user, 'Confirmar', 'Motivo')

    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(screen.queryByText('mensaje crudo del servidor')).not.toBeInTheDocument()
  })

  it('un error sin código mapeado muestra el mensaje del servidor', async () => {
    vi.mocked(adminService.confirmSanction).mockRejectedValue(
      errorConCodigo('Caso de sanción no encontrado', 'OTRO', 404)
    )
    const user = userEvent.setup()
    renderPage()
    await decidir(user, 'Confirmar', 'Motivo')

    expect(await screen.findByText('Caso de sanción no encontrado')).toBeInTheDocument()
  })

  it('muestra el error de carga con reintento', async () => {
    vi.mocked(adminService.listPendingSanctions).mockRejectedValueOnce(new Error('Falló la carga'))
    renderPage()

    expect(await screen.findByText('Falló la carga')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
