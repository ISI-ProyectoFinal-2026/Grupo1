import { api } from "./api";
import type { GeoBounds, GeoMapFilters, ReportDTO } from "@/types/report.types";

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
