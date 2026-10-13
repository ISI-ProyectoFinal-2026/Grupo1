import { useMutation } from '@tanstack/react-query'
import { resetPassword } from '@/services/auth.service'
import type { ResetPasswordInput } from '@/types/auth'

export function useResetPassword() {
  return useMutation({ mutationFn: (input: ResetPasswordInput) => resetPassword(input) })
}
