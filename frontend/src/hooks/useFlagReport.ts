import { useMutation } from '@tanstack/react-query'
import { createReportFlag } from '@/services/moderation.service'
import { getApiErrorStatus } from '@/services/api'
import type { CreateReportFlagInput } from '@/types/moderation.types'

const ALREADY_FLAGGED_MESSAGE = 'Ya denunciaste este reporte.'
const UNAVAILABLE_MESSAGE = 'Este reporte ya no está disponible para denunciar.'
const OWN_REPORT_MESSAGE = 'No podés denunciar tu propia publicación.'

// errores donde reintentar no sirve
const FINAL_MESSAGES: Record<number, string> = {
  409: ALREADY_FLAGGED_MESSAGE,
  404: UNAVAILABLE_MESSAGE,
  403: OWN_REPORT_MESSAGE,
}

export function useFlagReport(reportId: number) {
  const mutation = useMutation({
    mutationFn: (input: CreateReportFlagInput) => createReportFlag(reportId, input),
  })

  // 409 (ya denunciado), 404 (ya no publicado) y 403 (propio): reintentar no
  // sirve, así que cuentan como terminado igual que una denuncia exitosa.
  const finalMessage = mutation.isError ? FINAL_MESSAGES[getApiErrorStatus(mutation.error) ?? 0] : undefined
  const error = mutation.isError ? (finalMessage ?? mutation.error.message) : null

  return {
    flag: (input: CreateReportFlagInput) => mutation.mutate(input),
    isPending: mutation.isPending,
    isSent: mutation.isSuccess,
    isDone: mutation.isSuccess || finalMessage !== undefined,
    error,
  }
}
