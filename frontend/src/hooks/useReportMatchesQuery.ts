import { useQuery } from "@tanstack/react-query";
import { getMatches } from "@/services/reports.service";
import { useAuthStore } from "@/stores/auth.store";
import type { ReportStatus } from "@/types/report.types";

export const reportMatchesQueryKey = (id: number | undefined) => ["report-matches", id] as const;

export function useReportMatchesQuery(id: number | undefined, status: ReportStatus | undefined) {
  // el backend exige sesión: sin token el 401 mandaría al visitante al login (#187)
  const hasSession = useAuthStore((state) => state.token !== null);
  return useQuery({
    queryKey: reportMatchesQueryKey(id),
    queryFn: () => getMatches(id!),
    enabled: hasSession && !!id && status !== undefined && status !== "pending",
  });
}
