import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { confirmSanction, listPendingSanctions, revertSanction } from '@/services/admin.service'
import { getApiErrorStatus } from '@/services/api'

const SANCTIONS_KEY = ['admin', 'sanctions'] as const

export function usePendingSanctions(enabled = true) {
  return useQuery({ queryKey: SANCTIONS_KEY, queryFn: listPendingSanctions, enabled })
}

export function useDecideSanction() {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: SANCTIONS_KEY })

  return useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: number
      action: 'confirm' | 'revert'
      reason: string
    }) => (action === 'confirm' ? confirmSanction(id, reason) : revertSanction(id, reason)),
    onSuccess: refresh,
    // 409: otra persona decidió antes; 404: la cuenta ya fue eliminada. La cola se refresca
    onError: (error) => {
      const status = getApiErrorStatus(error)
      if (status === 409 || status === 404) refresh()
    },
  })
}
