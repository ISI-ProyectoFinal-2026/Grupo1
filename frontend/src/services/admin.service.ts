import { api } from './api'
import type {
  AdminUser,
  AdminUsersQuery,
  Paginated,
  RoleAuditEntry,
  RoleAuditQuery,
} from '@/types/admin.types'
import type { Role } from '@/types/auth'

export async function listAdminUsers({
  q,
  role,
  ...paging
}: AdminUsersQuery): Promise<Paginated<AdminUser>> {
  // q y role vacíos no se mandan: el backend los valida
  const params = { ...(q && { q }), ...(role && { role }), ...paging }
  const { data } = await api.get<Paginated<AdminUser>>('/admin/users', { params })
  return data
}

export async function listRoleAudit(params: RoleAuditQuery): Promise<Paginated<RoleAuditEntry>> {
  const { data } = await api.get<Paginated<RoleAuditEntry>>('/admin/role-audit', { params })
  return data
}

export async function changeUserRole(id: number, role: Role): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/admin/users/${id}/role`, { role })
  return data
}
