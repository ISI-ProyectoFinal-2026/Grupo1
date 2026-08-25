import { useQuery } from "@tanstack/react-query";
import { getMatches } from "@/services/reports.service";
import type { ReportStatus } from "@/types/report.types";

export function useReportMatchesQuery(id: number | undefined, status: ReportStatus | undefined) {
  return useQuery({
    queryKey: ["report-matches", id],
    queryFn: () => getMatches(id!),
    enabled: !!id && status !== undefined && status !== "pending",
  });
}
