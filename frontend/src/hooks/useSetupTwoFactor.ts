import { useMutation } from '@tanstack/react-query'
import { setupTwoFactor } from '@/services/two-factor.service'

// gcTime 0: el secreto no se queda en la cache de mutaciones al reiniciar.
export function useSetupTwoFactor() {
  return useMutation({ mutationFn: setupTwoFactor, gcTime: 0 })
}
