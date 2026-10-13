import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMe } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'

export const CURRENT_USER_QUERY_KEY = ['auth', 'me'] as const

/**
 * Refresca el usuario guardado en `patitas-auth` contra GET /auth/me: el store
 * persiste `emailVerifiedAt`, que cambia fuera de esta pestaña (el usuario abre
 * el link del mail en otra). Corre al abrir la app y al volver a la pestaña.
 * Si /me falla, el store queda como está: el 401 ya lo maneja el interceptor.
 */
export function useCurrentUser() {
  const token = useAuthStore((state) => state.token)
  const setUser = useAuthStore((state) => state.setUser)

  const query = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getMe,
    enabled: token !== null,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (query.data) {
      setUser(query.data)
    }
  }, [query.data, setUser])

  return query
}
