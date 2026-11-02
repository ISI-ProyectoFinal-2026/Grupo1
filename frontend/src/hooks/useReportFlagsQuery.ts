import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listReportFlags, resolveReportFlag } from '@/services/moderation.service'
import type { ResolveReportFlagAction } from '@/types/moderation.types'

export const reportFlagsQueryKey = ['report-flags', 'pending'] as const

export function useReportFlagsQuery() {
  return useQuery({
    queryKey: reportFlagsQueryKey,
    queryFn: () => listReportFlags('pending'),
  })
}

export function useResolveReportFlagMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: ResolveReportFlagAction }) => resolveReportFlag(id, action),
    // Resolver saca al flag de la cola pendiente: hay que refrescarla para que
    // el resuelto desaparezca de la pantalla.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportFlagsQueryKey }),
  })
}
