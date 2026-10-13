import { useTwoFactorSessionMutation } from '@/hooks/useTwoFactorSessionMutation'
import { enableTwoFactor } from '@/services/two-factor.service'

export function useEnableTwoFactor() {
  return useTwoFactorSessionMutation(enableTwoFactor)
}
