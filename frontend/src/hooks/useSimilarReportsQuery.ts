import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { findSimilarReports } from '@/services/reports.service'
import type { ReportLocation, ReportType } from '@/types/report.types'

// La foto es parte de la clave: subirla o cambiarla vuelve a ordenar por similitud.
export function useSimilarReportsQuery(
  reportType: ReportType,
  location: ReportLocation | undefined,
  imageUrl: string | undefined
) {
  return useQuery({
    queryKey: ['similar-reports', reportType, location?.lat, location?.lng, imageUrl ?? null],
    queryFn: () =>
      findSimilarReports({ reportType, location: location!, ...(imageUrl ? { imageUrl } : {}) }),
    enabled: location !== undefined,
    // las sugerencias son opcionales: un error no se reintenta ni se muestra
    retry: false,
    placeholderData: keepPreviousData,
  })
}
