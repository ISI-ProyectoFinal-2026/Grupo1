import type { Role } from '@/types/auth'

export const ROLE_LABELS: Record<Role, string> = {
  usuario_regular: 'Usuario',
  moderador: 'Moderador',
  admin: 'Administrador',
}

export interface AdminUser {
  id: number
  email: string
  fullName: string | null
  role: Role
  createdAt: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface AuditPerson {
  id: number
  email: string
  fullName: string | null
}

export interface RoleAuditEntry {
  id: number
  createdAt: string
  previousRole: Role
  newRole: Role
  actor: AuditPerson
  target: AuditPerson
}

export interface RoleAuditQuery {
  page: number
  pageSize: number
}

export interface AdminUsersQuery {
  q: string
  role: Role | ''
  page: number
  pageSize: number
}
