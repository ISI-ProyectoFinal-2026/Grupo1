import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import type { Role } from '@/types/auth'

interface RequireRoleProps {
  roles: Role[]
}

/**
 * Guard por rol, para anidar dentro de ProtectedRoute: cuando llega aca el
 * usuario ya tiene sesion, asi que un rol insuficiente va al inicio y no al
 * login (mandarlo a loguearse de nuevo no cambiaria nada).
 *
 * Es solo navegacion. El permiso lo hace cumplir el backend con `requireRole`.
 */
function RequireRole({ roles }: RequireRoleProps) {
  const user = useAuthStore((state) => state.user)

  if (!user || !roles.includes(user.role)) {
    return <Navigate to='/' replace />
  }

  return <Outlet />
}

export default RequireRole
