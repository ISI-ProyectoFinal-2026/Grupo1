import { useMutation, useQueryClient } from '@tanstack/react-query'
import { closeReport } from '@/services/reports.service'
import { getApiErrorStatus } from '@/services/api'
import { reportDetailQueryKey } from '@/hooks/useReportDetailQuery'

const ALREADY_CLOSED_MESSAGE = 'Este reporte ya estaba cerrado.'

export function useCloseReport(reportId: number) {
  const queryClient = useQueryClient()
  // El backend devuelve el reporte ya en resolved: se escribe directo en el
  // cache del detalle para que la página lo muestre sin otro GET.
  const mutation = useMutation({
    mutationFn: () => closeReport(reportId),
    onSuccess: (report) => queryClient.setQueryData(reportDetailQueryKey(reportId), report),
    // Un 409 significa que el detalle en pantalla quedó viejo: se vuelve a pedir.
    onError: (error) => {
      if (getApiErrorStatus(error) === 409) {
        queryClient.invalidateQueries({ queryKey: reportDetailQueryKey(reportId) })
      }
    },
  })

  const error = mutation.isError
    ? getApiErrorStatus(mutation.error) === 409
      ? ALREADY_CLOSED_MESSAGE
      : mutation.error.message
    : null

  return { close: () => mutation.mutate(), isPending: mutation.isPending, error }
}
