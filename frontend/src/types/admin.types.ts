import type { Role } from '@/types/auth'
import type { AccountReportSeverity } from '@/types/moderation.types'

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

export type SanctionKind = 'temporary' | 'provisional' | 'permanent'
export type SanctionStatus = 'active' | 'pending_review' | 'expired' | 'reverted' | 'dismissed'

// caso de la cola (#38): sin denunciantes ni ids de denuncias; id = id de la sanción
export interface SanctionQueueItem {
  id: number
  account: { id: number; fullName: string | null; email: string }
  role: Role
  kind: SanctionKind
  status: SanctionStatus
  severity: AccountReportSeverity
  severityCounts: Record<AccountReportSeverity, number>
  reportDates: string[]
}

export interface SanctionDecision {
  id: number
  status: SanctionStatus
  kind: SanctionKind
  endsAt: string | null
}
