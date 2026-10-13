import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CURRENT_USER_QUERY_KEY } from '@/hooks/useCurrentUser'
import { TWO_FACTOR_STATUS_QUERY_KEY } from '@/hooks/useTwoFactorStatus'
import { getApiErrorStatus } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthResponse } from '@/types/auth'

const STATE_CONFLICT_STATUS = 409

/**
 * Base de las acciones de 2FA que suben `tokenVersion` (activar, desactivar,
 * regenerar códigos): el JWT anterior deja de valer en el servidor, así que el
 * nuevo se guarda ANTES de invalidar o pedir cualquier otra cosa.
 *
 * `gcTime: 0` evita que los códigos de recuperación de la respuesta queden en
 * la cache de mutaciones una vez que el componente los copió a su state.
 */
export function useTwoFactorSessionMutation<TInput, TData extends AuthResponse>(
  mutationFn: (input: TInput) => Promise<TData>
) {
  const queryClient = useQueryClient()

  return useMutation({
    // Envuelta a propósito: TanStack le pasa un segundo argumento (contexto).
    mutationFn: (input: TInput) => mutationFn(input),
    gcTime: 0,
    onSuccess: ({ token, user }) => {
      useAuthStore.getState().setAuth(token, user)
      queryClient.invalidateQueries({ queryKey: TWO_FACTOR_STATUS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY })
    },
    // Un 409 significa que el estado real es otro (p. ej. se desactivó desde otra
    // pestaña): se vuelve a pedir para que la pantalla se corrija sola.
    onError: (error) => {
      if (getApiErrorStatus(error) === STATE_CONFLICT_STATUS) {
        queryClient.invalidateQueries({ queryKey: TWO_FACTOR_STATUS_QUERY_KEY })
      }
    },
  })
}
