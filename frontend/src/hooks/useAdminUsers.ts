import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CURRENT_USER_QUERY_KEY } from '@/hooks/useCurrentUser'
import { getApiErrorStatus } from '@/services/api'
import { changeUserRole, listAdminUsers, listRoleAudit } from '@/services/admin.service'
import type { AdminUsersQuery, RoleAuditQuery } from '@/types/admin.types'
import type { Role } from '@/types/auth'

const USERS_KEY = ['admin', 'users'] as const
const AUDIT_KEY = ['admin', 'role-audit'] as const

export function useAdminUsers(params: AdminUsersQuery) {
  return useQuery({
    queryKey: [...USERS_KEY, params],
    queryFn: () => listAdminUsers(params),
    placeholderData: keepPreviousData,
  })
}

export function useRoleAudit(params: RoleAuditQuery) {
  return useQuery({
    queryKey: [...AUDIT_KEY, params],
    queryFn: () => listRoleAudit(params),
    placeholderData: keepPreviousData,
  })
}

export function useChangeUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) => changeUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY })
      queryClient.invalidateQueries({ queryKey: AUDIT_KEY })
    },
    // 403: el admin dejó de serlo; refrescar /auth/me hace que el guard lo saque
    onError: (error) => {
      if (getApiErrorStatus(error) === 403) {
        queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY })
      }
    },
  })
}
