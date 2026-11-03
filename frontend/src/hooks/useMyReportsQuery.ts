import { useQuery } from '@tanstack/react-query'
import { listMyReports } from '@/services/reports.service'

// bajo el prefijo ['reports']: editar o eliminar ya lo invalida
export const myReportsQueryKey = ['reports', 'mine'] as const

export function useMyReportsQuery() {
  return useQuery({ queryKey: myReportsQueryKey, queryFn: listMyReports })
}
