import { useQuery, type QueryClient } from '@tanstack/react-query'
import { getInactivityWarning } from '@/services/reports.service'

export const inactivityWarningQueryKey = (id: number) => ['report', id, 'inactivity-warning'] as const

// el backend marca leídos los avisos al cerrar, editar o confirmar (#332)
export function invalidateInactivityWarnings(queryClient: QueryClient, reportId: number) {
  queryClient.invalidateQueries({ queryKey: ['notifications'] })
  queryClient.invalidateQueries({ queryKey: inactivityWarningQueryKey(reportId) })
}

// 401/403/404 se tratan como "sin aviso": sin reintentos
export function useInactivityWarningQuery(id: number, enabled: boolean) {
  return useQuery({
    queryKey: inactivityWarningQueryKey(id),
    queryFn: () => getInactivityWarning(id),
    enabled,
    retry: false,
  })
}
