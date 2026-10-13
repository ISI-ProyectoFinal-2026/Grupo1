import { useTwoFactorSessionMutation } from '@/hooks/useTwoFactorSessionMutation'
import { disableTwoFactor } from '@/services/two-factor.service'

export function useDisableTwoFactor() {
  return useTwoFactorSessionMutation(disableTwoFactor)
}
