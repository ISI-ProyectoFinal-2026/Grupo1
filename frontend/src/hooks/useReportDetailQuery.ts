import { useQuery } from "@tanstack/react-query";
import { getReport } from "@/services/reports.service";

const POLL_INTERVAL_MS = 3000;

export const reportDetailQueryKey = (id: number | undefined) => ["report", id] as const;

export function useReportDetailQuery(id: number | undefined) {
  return useQuery({
    queryKey: reportDetailQueryKey(id),
    queryFn: () => getReport(id!),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.status === "pending" ? POLL_INTERVAL_MS : false),
  });
}
