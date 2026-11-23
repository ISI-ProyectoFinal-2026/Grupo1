import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CURRENT_USER_QUERY_KEY } from '@/hooks/useCurrentUser'
import { updateProfile } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import type { UpdateProfileInput } from '@/types/auth'

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: (user) => {
      // el store alimenta ReportForm: la casilla del flyer aparece al cargar el teléfono
      useAuthStore.getState().setUser(user)
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY })
    },
  })
}
