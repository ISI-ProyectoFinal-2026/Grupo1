import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listReportFlagGroups, moderateReport } from '@/services/moderation.service'
import type { ModerationAction } from '@/types/moderation.types'

export const reportFlagGroupsQueryKey = ['report-flags', 'groups'] as const

export function useReportFlagGroupsQuery() {
  return useQuery({
    queryKey: reportFlagGroupsQueryKey,
    queryFn: listReportFlagGroups,
  })
}

export function useModerateReportMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ reportId, action }: { reportId: number; action: ModerationAction }) =>
      moderateReport(reportId, action),
    // también tras un 409: otro moderador ya resolvió y la cola quedó vieja
    onSettled: () => queryClient.invalidateQueries({ queryKey: reportFlagGroupsQueryKey }),
  })
}
