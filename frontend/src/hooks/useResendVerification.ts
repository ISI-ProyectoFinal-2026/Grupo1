import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CURRENT_USER_QUERY_KEY } from '@/hooks/useCurrentUser'
import { getApiErrorStatus } from '@/services/api'
import { resendVerification } from '@/services/auth.service'

export const ALREADY_VERIFIED_STATUS = 409

export function useResendVerification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resendVerification,
    // Un 409 significa que el email ya quedó verificado (otra pestaña, otro
    // dispositivo): se vuelve a pedir /me para que el banner se esconda solo.
    onError: (error) => {
      if (getApiErrorStatus(error) === ALREADY_VERIFIED_STATUS) {
        queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY })
      }
    },
  })
}
