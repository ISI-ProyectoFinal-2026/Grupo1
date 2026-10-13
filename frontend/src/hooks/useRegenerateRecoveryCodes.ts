import { useTwoFactorSessionMutation } from '@/hooks/useTwoFactorSessionMutation'
import { regenerateRecoveryCodes } from '@/services/two-factor.service'

export function useRegenerateRecoveryCodes() {
  return useTwoFactorSessionMutation(regenerateRecoveryCodes)
}
