import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteReport } from '@/services/reports.service'
import { getApiErrorStatus } from '@/services/api'
import { reportDetailQueryKey } from '@/hooks/useReportDetailQuery'

const GENERIC_ERROR_MESSAGE = 'No se pudo eliminar el reporte, intentá de nuevo.'

export function useDeleteReport(reportId: number, onDeleted: () => void) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => deleteReport(reportId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: reportDetailQueryKey(reportId) })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      onDeleted()
    },
  })

  const status = mutation.isError ? getApiErrorStatus(mutation.error) : undefined
  const error = mutation.isError
    ? status === undefined || status >= 500
      ? GENERIC_ERROR_MESSAGE
      : mutation.error.message
    : null

  return { remove: () => mutation.mutate(), isPending: mutation.isPending, error }
}
