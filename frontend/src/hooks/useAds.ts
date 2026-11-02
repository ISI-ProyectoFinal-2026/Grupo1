import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAd, deleteAd, getAdStats, listMyAds, setAdStatus, updateAd } from "@/services/ads.service";
import type { AdInput } from "@/types/ad.types";

const myAdsQueryKey = ["ads", "me"] as const;

export function useMyAdsQuery() {
  return useQuery({ queryKey: myAdsQueryKey, queryFn: listMyAds });
}

export function useAdStatsQuery(adId: number) {
  return useQuery({ queryKey: [...myAdsQueryKey, adId, "stats"], queryFn: () => getAdStats(adId) });
}

// toda escritura refresca el listado: cambia el contador de activos
function useInvalidateMyAds() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: myAdsQueryKey });
}

export function useCreateAdMutation() {
  const onSuccess = useInvalidateMyAds();
  return useMutation({ mutationFn: (input: AdInput) => createAd(input), onSuccess });
}

export function useUpdateAdMutation() {
  const onSuccess = useInvalidateMyAds();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<AdInput> }) => updateAd(id, input),
    onSuccess,
  });
}

export function useSetAdStatusMutation() {
  const onSuccess = useInvalidateMyAds();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ACTIVE" | "PAUSED" }) => setAdStatus(id, status),
    onSuccess,
  });
}

export function useDeleteAdMutation() {
  const onSuccess = useInvalidateMyAds();
  return useMutation({ mutationFn: (id: number) => deleteAd(id), onSuccess });
}
