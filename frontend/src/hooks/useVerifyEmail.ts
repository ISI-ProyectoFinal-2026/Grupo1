import { useMutation } from '@tanstack/react-query'
import { verifyEmail } from '@/services/auth.service'

export function useVerifyEmail() {
  return useMutation({ mutationFn: (token: string) => verifyEmail(token) })
}
