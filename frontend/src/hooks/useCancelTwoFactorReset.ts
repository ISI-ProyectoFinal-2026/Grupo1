import { useMutation } from '@tanstack/react-query'
import { cancelTwoFactorReset } from '@/services/two-factor.service'

export function useCancelTwoFactorReset() {
  return useMutation({ mutationFn: (token: string) => cancelTwoFactorReset(token) })
}
