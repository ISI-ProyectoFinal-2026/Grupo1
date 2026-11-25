import { useMutation } from '@tanstack/react-query'
import { getFlyer } from '@/services/reports.service'

export function useReportFlyer(reportId: number, onGenerated: (flyerUrl: string) => void) {
  const mutation = useMutation({
    mutationFn: () => getFlyer(reportId),
    onSuccess: (data) => onGenerated(data.flyerUrl),
  })

  return {
    generate: () => mutation.mutate(),
    isPending: mutation.isPending,
    isError: mutation.isError,
  }
}
