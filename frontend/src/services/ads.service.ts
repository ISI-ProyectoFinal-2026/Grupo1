import { api } from "./api";
import type { Ad, AdFlagDTO, AdInput, AdPlacement, AdStats, NearbyBusiness, ServedAd } from "@/types/ad.types";

const BASE = "/businesses/me/ads";

export function listMyAds(): Promise<Ad[]> {
  return api.get<Ad[]>(BASE).then((res) => res.data);
}

export function createAd(input: AdInput): Promise<Ad> {
  return api.post<Ad>(BASE, input).then((res) => res.data);
}

export function updateAd(id: number, input: Partial<AdInput>): Promise<Ad> {
  return api.put<Ad>(`${BASE}/${id}`, input).then((res) => res.data);
}

// REMOVED solo lo asigna moderación
export function setAdStatus(id: number, status: "ACTIVE" | "PAUSED"): Promise<Ad> {
  return api.patch<Ad>(`${BASE}/${id}/status`, { status }).then((res) => res.data);
}

export function deleteAd(id: number): Promise<void> {
  return api.delete(`${BASE}/${id}`).then(() => undefined);
}

export function getAdStats(id: number): Promise<AdStats> {
  return api.get<AdStats>(`${BASE}/${id}/stats`).then((res) => res.data);
}

// público: con sesión el backend segmenta por la ubicación consentida; null = sin anuncios
export function getAdFor(placement: AdPlacement, reportId?: number): Promise<ServedAd | null> {
  return api
    .get<ServedAd | null>("/ads", { params: { placement, ...(reportId ? { reportId } : {}) } })
    .then((res) => res.data ?? null);
}

export function recordAdEvent(adId: number, type: "impression" | "click", placement: AdPlacement): Promise<void> {
  return api.post(`/ads/${adId}/events`, { type, placement }).then(() => undefined);
}

export function flagAd(adId: number, reason: string): Promise<void> {
  return api.post(`/ads/${adId}/flags`, { reason }).then(() => undefined);
}

export function getNearbyBusinesses(reportId: number): Promise<NearbyBusiness[]> {
  return api.get<NearbyBusiness[]>(`/reports/${reportId}/nearby-businesses`).then((res) => res.data);
}

// moderación (rol moderador/admin)
export function listAdFlags(): Promise<AdFlagDTO[]> {
  return api.get<AdFlagDTO[]>("/ad-flags").then((res) => res.data);
}

export function resolveAdFlag(id: number, action: "remove" | "dismiss"): Promise<AdFlagDTO> {
  return api.patch<AdFlagDTO>(`/ad-flags/${id}`, { action }).then((res) => res.data);
}
