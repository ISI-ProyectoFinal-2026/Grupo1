import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser } from '@/types/auth'

// Solo decide qué muestra la UI; el backend hace cumplir el rol (requireRole).
export function isAdmin(user: AuthUser | null): boolean {
  return user !== null && user.role === 'admin'
}

export function useIsAdmin(): boolean {
  return useAuthStore((state) => isAdmin(state.user))
}
