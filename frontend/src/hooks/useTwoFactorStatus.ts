import { useQuery } from '@tanstack/react-query'
import { getTwoFactorStatus } from '@/services/two-factor.service'

export const TWO_FACTOR_STATUS_QUERY_KEY = ['auth', '2fa'] as const

export function useTwoFactorStatus() {
  return useQuery({
    queryKey: TWO_FACTOR_STATUS_QUERY_KEY,
    queryFn: getTwoFactorStatus,
  })
}
