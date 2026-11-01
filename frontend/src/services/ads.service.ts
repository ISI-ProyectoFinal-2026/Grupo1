import { api } from "./api";
import type { Ad, AdInput, AdStats } from "@/types/ad.types";

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
