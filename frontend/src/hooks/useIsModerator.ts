import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser, Role } from '@/types/auth'

export const MODERATOR_ROLES: Role[] = ['moderador', 'admin']

/**
 * Solo decide que muestra la UI. La autorizacion real vive en el backend
 * (`requireRole`), que resuelve el rol contra la base en cada request: un
 * usuario que editara su localStorage no gana nada mas que ver una pantalla
 * que le va a responder 403.
 *
 * Una sesion guardada antes de que existiera el rol no tiene `role` en
 * localStorage; al no estar en la lista, cae del lado seguro.
 */
export function isModerator(user: AuthUser | null): boolean {
  return user !== null && MODERATOR_ROLES.includes(user.role)
}

export function useIsModerator(): boolean {
  return useAuthStore((state) => isModerator(state.user))
}
