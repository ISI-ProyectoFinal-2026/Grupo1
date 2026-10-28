import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateReport } from '@/services/reports.service'
import { reportDetailQueryKey } from '@/hooks/useReportDetailQuery'
import { reportMatchesQueryKey } from '@/hooks/useReportMatchesQuery'
import type { UpdateReportInput } from '@/types/report.types'

export function useUpdateReport(reportId: number) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (input: UpdateReportInput) => updateReport(reportId, input),
    onSuccess: (report) => {
      queryClient.setQueryData(reportDetailQueryKey(reportId), report)
      // A new photo sends the report back to moderation: the feed and the
      // matches computed from the old photo are stale.
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: reportMatchesQueryKey(reportId) })
    },
  })

  // The form shows the error itself, so the promise is handed over as is.
  return { update: mutation.mutateAsync }
}
