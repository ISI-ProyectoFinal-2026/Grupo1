import { useMutation } from '@tanstack/react-query'
import { createReportFlag } from '@/services/moderation.service'
import { getApiErrorStatus } from '@/services/api'

const ALREADY_FLAGGED_MESSAGE = 'Ya denunciaste este reporte.'

export function useFlagReport(reportId: number) {
  const mutation = useMutation({
    mutationFn: (reason: string) => createReportFlag(reportId, reason),
  })

  // 409: este usuario ya lo había denunciado. Reintentar no sirve, así que
  // cuenta como terminado igual que una denuncia exitosa.
  const alreadyFlagged = mutation.isError && getApiErrorStatus(mutation.error) === 409
  const error = mutation.isError
    ? alreadyFlagged
      ? ALREADY_FLAGGED_MESSAGE
      : mutation.error.message
    : null

  return {
    flag: (reason: string) => mutation.mutate(reason),
    isPending: mutation.isPending,
    isSent: mutation.isSuccess,
    isDone: mutation.isSuccess || alreadyFlagged,
    error,
  }
}
