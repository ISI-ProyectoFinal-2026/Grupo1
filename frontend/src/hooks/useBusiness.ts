import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBusiness,
  getMyBusiness,
  getMyBusinessStats,
  updateMyBusiness,
} from "@/services/business.service";
import { getApiErrorStatus } from "@/services/api";
import type { CreateBusinessInput, UpdateBusinessInput } from "@/types/business.types";

export const businessQueryKey = ["business", "me"] as const;
export const businessStatsQueryKey = ["business", "me", "stats"] as const;

export function hasNoBusiness(error: unknown): boolean {
  return getApiErrorStatus(error) === 404;
}

// GET /me responde 404 cuando el usuario todavía no registró un comercio: es
// un estado válido ("no es comercio"), no una falla transitoria para reintentar.
export function useMyBusinessQuery() {
  return useQuery({
    queryKey: businessQueryKey,
    queryFn: getMyBusiness,
    retry: false,
  });
}

export function useMyBusinessStatsQuery(enabled: boolean) {
  return useQuery({
    queryKey: businessStatsQueryKey,
    queryFn: getMyBusinessStats,
    enabled,
  });
}

export function useCreateBusinessMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBusinessInput) => createBusiness(input),
    onSuccess: (business) => queryClient.setQueryData(businessQueryKey, business),
  });
}

export function useUpdateBusinessMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBusinessInput) => updateMyBusiness(input),
    onSuccess: (business) => queryClient.setQueryData(businessQueryKey, business),
  });
}
