import { useMutation, useQueryClient } from '@tanstack/react-query'
import { confirmMatch, rejectMatch } from '@/services/reports.service'
import { reportMatchesQueryKey } from '@/hooks/useReportMatchesQuery'

export function useMatchActions(reportId: number) {
  const queryClient = useQueryClient()
  // Se refresca al terminar, salga bien o mal: un 409 suele significar que la
  // otra parte ya decidió, y la lista tiene que mostrar ese estado real. Se
  // devuelve la promesa para que la mutación siga "en curso" hasta que llegue
  // la lista nueva y no se pueda decidir sobre datos viejos.
  const refreshMatches = () =>
    queryClient.invalidateQueries({ queryKey: reportMatchesQueryKey(reportId) })

  const confirm = useMutation({
    mutationFn: (matchId: number) => confirmMatch(reportId, matchId),
    onSettled: refreshMatches,
  })
  const reject = useMutation({
    mutationFn: (matchId: number) => rejectMatch(reportId, matchId),
    onSettled: refreshMatches,
  })

  // Una sola decisión a la vez para todo el reporte: si no, confirmar A y
  // después B pisa las `variables` de la mutación y A se rehabilita en vuelo.
  const isBusy = confirm.isPending || reject.isPending

  // Cada acción limpia el resultado de la otra, así el error que se muestra
  // es siempre el de la última decisión y no uno viejo de un intento previo.
  const confirmOne = (matchId: number) => {
    reject.reset()
    confirm.mutate(matchId)
  }
  const rejectOne = (matchId: number) => {
    confirm.reset()
    reject.mutate(matchId)
  }

  // cada mutación recuerda sobre qué coincidencia se disparó (variables)
  const errorFor = (matchId: number): string | null => {
    if (confirm.isError && confirm.variables === matchId) return confirm.error.message
    if (reject.isError && reject.variables === matchId) return reject.error.message
    return null
  }

  return { confirm: confirmOne, reject: rejectOne, isBusy, errorFor }
}
