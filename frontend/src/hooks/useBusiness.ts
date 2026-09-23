import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  contactBusiness,
  createBusiness,
  getBusiness,
  getMyBusiness,
  getMyBusinessStats,
  listBusinesses,
  updateMyBusiness,
} from "@/services/business.service";
import { getApiErrorStatus } from "@/services/api";
import type { BusinessCategory, CreateBusinessInput, UpdateBusinessInput } from "@/types/business.types";

export const businessQueryKey = ["business", "me"] as const;
export const businessStatsQueryKey = ["business", "me", "stats"] as const;
export const businessesQueryKey = ["businesses"] as const;

export function useBusinessesQuery(category?: BusinessCategory) {
  return useQuery({
    queryKey: [...businessesQueryKey, category ?? "all"],
    queryFn: () => listBusinesses(category),
  });
}

export function useBusinessQuery(id: number | undefined) {
  return useQuery({
    queryKey: [...businessesQueryKey, id],
    queryFn: () => getBusiness(id!),
    enabled: id !== undefined,
  });
}

export function useContactBusinessMutation() {
  return useMutation({
    mutationFn: (id: number) => contactBusiness(id),
  });
}

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
