import { useMutation } from '@tanstack/react-query'
import { confirmTwoFactorReset } from '@/services/two-factor.service'

export function useConfirmTwoFactorReset() {
  return useMutation({ mutationFn: (token: string) => confirmTwoFactorReset(token) })
}
