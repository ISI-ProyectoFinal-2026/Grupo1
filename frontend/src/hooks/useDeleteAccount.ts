import { useMutation } from '@tanstack/react-query'
import { deleteAccount } from '@/services/auth.service'
import type { AccountDeleteInput } from '@/types/auth'

export function useDeleteAccount() {
  // gcTime 0: la contraseña no queda en la cache de mutaciones
  return useMutation({ mutationFn: (input: AccountDeleteInput) => deleteAccount(input), gcTime: 0 })
}
