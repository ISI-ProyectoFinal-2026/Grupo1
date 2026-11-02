import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { flagAd, getAdFor, getNearbyBusinesses, listAdFlags, resolveAdFlag } from "@/services/ads.service";
import { getApiErrorStatus } from "@/services/api";
import type { AdPlacement } from "@/types/ad.types";

// se pide de nuevo en cada montaje (rota y no muestra uno dado de baja); el foco no lo cambia
export function useServedAdQuery(placement: AdPlacement, reportId?: number) {
  return useQuery({
    queryKey: ["served-ad", placement, reportId ?? null],
    queryFn: () => getAdFor(placement, reportId),
    refetchOnWindowFocus: false,
  });
}

export function useNearbyBusinessesQuery(reportId: number) {
  return useQuery({
    queryKey: ["nearby-businesses", reportId],
    queryFn: () => getNearbyBusinesses(reportId),
  });
}

const ALREADY_FLAGGED_MESSAGE = "Ya denunciaste este anuncio.";

// misma forma que useFlagReport, para reusar FlagReportForm
export function useFlagAd(adId: number) {
  const mutation = useMutation({ mutationFn: (reason: string) => flagAd(adId, reason) });
  // 409: ya lo había denunciado, cuenta como terminado
  const alreadyFlagged = mutation.isError && getApiErrorStatus(mutation.error) === 409;
  const error = mutation.isError ? (alreadyFlagged ? ALREADY_FLAGGED_MESSAGE : mutation.error.message) : null;

  return {
    flag: (reason: string) => mutation.mutate(reason),
    isPending: mutation.isPending,
    isSent: mutation.isSuccess,
    isDone: mutation.isSuccess || alreadyFlagged,
    error,
  };
}

const adFlagsQueryKey = ["ad-flags", "pending"] as const;

export function useAdFlagsQuery() {
  return useQuery({ queryKey: adFlagsQueryKey, queryFn: listAdFlags });
}

// resolver saca la denuncia (y las del mismo anuncio, si se da de baja) de la cola
export function useResolveAdFlagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "remove" | "dismiss" }) => resolveAdFlag(id, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adFlagsQueryKey }),
  });
}
