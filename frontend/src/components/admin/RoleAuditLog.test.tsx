import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoleAuditLog from '@/components/admin/RoleAuditLog'
import * as adminService from '@/services/admin.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { Paginated, RoleAuditEntry } from '@/types/admin.types'

vi.mock('@/services/admin.service')

function entrada(overrides: Partial<RoleAuditEntry> = {}): RoleAuditEntry {
  return {
    id: 1,
    createdAt: '2026-09-02T10:00:00.000Z',
    previousRole: 'usuario_regular',
    newRole: 'moderador',
    actor: { id: 1, email: 'admin@example.com', fullName: 'Admin Root' },
    target: { id: 4, email: 'ana@example.com', fullName: 'Ana Pérez' },
    ...overrides,
  }
}

function pagina(
  items: RoleAuditEntry[],
  extra: Partial<Paginated<RoleAuditEntry>> = {}
): Paginated<RoleAuditEntry> {
  return { items, total: items.length, page: 1, pageSize: 10, ...extra }
}

function renderLog() {
  const { Wrapper } = createQueryWrapper()
  render(
    <Wrapper>
      <RoleAuditLog />
    </Wrapper>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RoleAuditLog', () => {
  it('muestra quién cambió el rol de quién, el rol anterior y el nuevo', async () => {
    vi.mocked(adminService.listRoleAudit).mockResolvedValue(pagina([entrada()]))
    renderLog()

    const fila = (await screen.findByText('Ana Pérez')).closest('tr')!
    expect(within(fila).getByText('Admin Root')).toBeInTheDocument()
    expect(within(fila).getByText('Usuario')).toBeInTheDocument()
    expect(within(fila).getByText('Moderador')).toBeInTheDocument()
  })

  it('usa el email cuando la persona no tiene nombre', async () => {
    vi.mocked(adminService.listRoleAudit).mockResolvedValue(
      pagina([entrada({ target: { id: 4, email: 'ana@example.com', fullName: null } })])
    )
    renderLog()

    expect(await screen.findByText('ana@example.com')).toBeInTheDocument()
  })

  it('muestra "Cuenta eliminada" si el admin que hizo el cambio ya no existe', async () => {
    vi.mocked(adminService.listRoleAudit).mockResolvedValue(pagina([entrada({ actor: null })]))
    renderLog()

    const fila = (await screen.findByText('Ana Pérez')).closest('tr')!
    expect(within(fila).getByText('Cuenta eliminada')).toBeInTheDocument()
  })

  it('avisa cuando todavía no hay cambios', async () => {
    vi.mocked(adminService.listRoleAudit).mockResolvedValue(pagina([]))
    renderLog()

    expect(await screen.findByText('Todavía no hay cambios de rol.')).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Paginación del registro' })
    ).not.toBeInTheDocument()
  })

  it('pagina con Anterior y Siguiente', async () => {
    vi.mocked(adminService.listRoleAudit).mockImplementation(async ({ page }) =>
      pagina(
        [entrada({ id: page, target: { id: 4, email: 'x@example.com', fullName: `Pág ${page}` } })],
        {
          total: 25,
          page,
        }
      )
    )
    renderLog()
    await screen.findByText('Pág 1')
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByText('Pág 2')).toBeInTheDocument()
    expect(adminService.listRoleAudit).toHaveBeenLastCalledWith({ page: 2, pageSize: 10 })
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))

    await waitFor(() =>
      expect(adminService.listRoleAudit).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 })
    )
  })

  it('no ofrece filtros', async () => {
    vi.mocked(adminService.listRoleAudit).mockResolvedValue(pagina([entrada()]))
    renderLog()
    await screen.findByText('Ana Pérez')

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('muestra el error y permite reintentar', async () => {
    vi.mocked(adminService.listRoleAudit)
      .mockRejectedValueOnce(new Error('Falló la carga'))
      .mockResolvedValue(pagina([entrada()]))
    renderLog()

    expect(await screen.findByText('Falló la carga')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
  })
})
