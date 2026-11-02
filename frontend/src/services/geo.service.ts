import { api } from "./api";
import type { GeoBounds, GeoMapFilters, ReportDTO } from "@/types/report.types";

// geocodificacion inversa via backend: respeta la politica de Nominatim (ADR-0025)
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  const { data } = await api.get<{ address: string | null }>("/geo/reverse", {
    params: { lat, lng },
    signal,
  });
  return data.address;
}

// bounds viaja como "swLat,swLng,neLat,neLng" (ver geo.validator del backend)
export async function listMapReports(
  bounds: GeoBounds,
  filters: GeoMapFilters = {},
  signal?: AbortSignal,
): Promise<ReportDTO[]> {
  const { data } = await api.get<ReportDTO[]>("/geo/map", {
    params: {
      ...filters,
      bounds: [bounds.swLat, bounds.swLng, bounds.neLat, bounds.neLng].join(","),
    },
    signal,
  });
  return data;
}
