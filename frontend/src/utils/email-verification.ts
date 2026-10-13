import type { AuthUser } from '@/types/auth'

/**
 * `undefined` (sesión persistida antes de existir el campo) significa "no se
 * sabe", no "sin verificar": mostrar el banner a un usuario ya verificado es
 * peor que no mostrarlo, y el próximo GET /auth/me lo corrige.
 */
export function isEmailUnverified(user: AuthUser | null): boolean {
  return user !== null && user.emailVerifiedAt === null
}
