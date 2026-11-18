import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { closeReport, keepReportActive } from '@/services/reports.service'
import { getApiErrorStatus } from '@/services/api'
import { reportDetailQueryKey } from '@/hooks/useReportDetailQuery'
import { inactivityWarningQueryKey } from '@/hooks/useInactivityWarningQuery'
import { myReportsQueryKey } from '@/hooks/useMyReportsQuery'

const NOT_PUBLISHED_MESSAGE = 'Este reporte ya no está publicado.'

export function useInactivityWarningActions(reportId: number) {
  const queryClient = useQueryClient()
  const [conflict, setConflict] = useState(false)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
    queryClient.invalidateQueries({ queryKey: reportDetailQueryKey(reportId) })
    queryClient.invalidateQueries({ queryKey: inactivityWarningQueryKey(reportId) })
    queryClient.invalidateQueries({ queryKey: myReportsQueryKey })
  }
  const options = {
    onSuccess: refresh,
    onError: (error: unknown) => {
      // 409: el reporte ya no está publicado, se refresca el estado real
      if (getApiErrorStatus(error) === 409) {
        setConflict(true)
        refresh()
      }
    },
  }

  const close = useMutation({ mutationFn: () => closeReport(reportId), ...options })
  const keep = useMutation({ mutationFn: () => keepReportActive(reportId), ...options })

  const failed = close.isError ? close : keep.isError ? keep : null
  const error = conflict
    ? NOT_PUBLISHED_MESSAGE
    : failed
      ? (failed.error as Error).message
      : null

  return {
    close: () => close.mutate(),
    keep: () => keep.mutate(),
    isPending: close.isPending || keep.isPending,
    done: conflict || close.isSuccess || keep.isSuccess,
    succeeded: close.isSuccess ? ('closed' as const) : keep.isSuccess ? ('kept' as const) : null,
    error,
  }
}
