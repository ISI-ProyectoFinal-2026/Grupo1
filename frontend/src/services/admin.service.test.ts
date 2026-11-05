import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import {
  changeUserRole,
  confirmSanction,
  listAdminUsers,
  listPendingSanctions,
  listRoleAudit,
  revertSanction,
} from '@/services/admin.service'
import type {
  AdminUser,
  Paginated,
  RoleAuditEntry,
  SanctionQueueItem,
} from '@/types/admin.types'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

function usuario(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 4,
    email: 'ana@example.com',
    fullName: 'Ana',
    role: 'usuario_regular',
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('admin.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista usuarios desde /admin/users con los filtros como params', async () => {
    const pagina: Paginated<AdminUser> = { items: [usuario()], total: 1, page: 2, pageSize: 20 }
    vi.mocked(api.get).mockResolvedValue(respuesta(pagina))

    const resultado = await listAdminUsers({ q: 'ana', role: 'moderador', page: 2, pageSize: 20 })

    expect(api.get).toHaveBeenCalledWith('/admin/users', {
      params: { q: 'ana', role: 'moderador', page: 2, pageSize: 20 },
    })
    expect(resultado).toEqual(pagina)
  })

  it('omite q y role vacíos de los params', async () => {
    vi.mocked(api.get).mockResolvedValue(respuesta({ items: [], total: 0, page: 1, pageSize: 20 }))

    await listAdminUsers({ q: '', role: '', page: 1, pageSize: 20 })

    expect(api.get).toHaveBeenCalledWith('/admin/users', { params: { page: 1, pageSize: 20 } })
  })

  it('lista el registro de cambios de rol con la paginación como params', async () => {
    const pagina: Paginated<RoleAuditEntry> = {
      items: [
        {
          id: 9,
          createdAt: '2026-09-02T10:00:00.000Z',
          previousRole: 'usuario_regular',
          newRole: 'moderador',
          actor: { id: 1, email: 'admin@example.com', fullName: 'Admin Root' },
          target: { id: 4, email: 'ana@example.com', fullName: null },
        },
      ],
      total: 1,
      page: 3,
      pageSize: 10,
    }
    vi.mocked(api.get).mockResolvedValue(respuesta(pagina))

    const resultado = await listRoleAudit({ page: 3, pageSize: 10 })

    expect(api.get).toHaveBeenCalledWith('/admin/role-audit', { params: { page: 3, pageSize: 10 } })
    expect(resultado).toEqual(pagina)
  })

  it('cambia el rol con PATCH /admin/users/:id/role', async () => {
    const actualizado = usuario({ role: 'moderador' })
    vi.mocked(api.patch).mockResolvedValue(respuesta(actualizado))

    const resultado = await changeUserRole(4, 'moderador')

    expect(api.patch).toHaveBeenCalledWith('/admin/users/4/role', { role: 'moderador' })
    expect(resultado.role).toBe('moderador')
  })

  it('lista la cola de sanciones desde GET /admin/account-sanctions/pending', async () => {
    const item: SanctionQueueItem = {
      id: 12,
      account: { id: 4, fullName: 'Ana', email: 'ana@example.com' },
      role: 'moderador',
      kind: 'provisional',
      status: 'active',
      severity: 'severe',
      severityCounts: { mild: 1, moderate: 1, severe: 3 },
      reportDates: ['2026-11-01T10:00:00.000Z'],
    }
    vi.mocked(api.get).mockResolvedValue(respuesta({ items: [item] }))

    const resultado = await listPendingSanctions()

    expect(api.get).toHaveBeenCalledWith('/admin/account-sanctions/pending')
    expect(resultado).toEqual({ items: [item] })
  })

  it('confirma una sanción con POST y el motivo', async () => {
    const decision = { id: 12, status: 'active', kind: 'permanent', endsAt: null }
    vi.mocked(api.post).mockResolvedValue(respuesta(decision))

    const resultado = await confirmSanction(12, 'Evidencia suficiente')

    expect(api.post).toHaveBeenCalledWith('/admin/account-sanctions/12/confirm', {
      reason: 'Evidencia suficiente',
    })
    expect(resultado).toEqual(decision)
  })

  it('revierte una sanción con POST y el motivo', async () => {
    const decision = { id: 12, status: 'reverted', kind: 'provisional', endsAt: null }
    vi.mocked(api.post).mockResolvedValue(respuesta(decision))

    const resultado = await revertSanction(12, 'Denuncias infundadas')

    expect(api.post).toHaveBeenCalledWith('/admin/account-sanctions/12/revert', {
      reason: 'Denuncias infundadas',
    })
    expect(resultado.status).toBe('reverted')
  })
})
