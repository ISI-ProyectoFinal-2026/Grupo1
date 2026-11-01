import { useEffect } from "react";
import { MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { Link } from "react-router-dom";
import type { GeoBounds, ReportDTO } from "@/types/report.types";
import OsmTileLayer from "@/components/maps/OsmTileLayer";
import { DEFAULT_MAP_ZOOM, PILOT_ZONE_CENTER } from "@/lib/map";
import { getReportPinIcon } from "@/components/reports/reportPinIcon";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
  reports: ReportDTO[];
  center?: [number, number];
  loading?: boolean;
  onBoundsChange?: (bounds: GeoBounds) => void;
}

// Alto relativo a la pantalla: en un telefono el mapa ocupa casi toda la vista
// sin tapar la tab bar; en desktop llena el area de contenido.
const MAP_HEIGHT = "h-[60vh] min-h-[320px] lg:h-[calc(100vh-17rem)]";

// avisa el area visible al montarse y cada vez que el mapa termina de moverse
function BoundsReporter({ onBoundsChange }: { onBoundsChange: (bounds: GeoBounds) => void }) {
  const map = useMap();
  const report = () => {
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    onBoundsChange({ swLat: sw.lat, swLng: sw.lng, neLat: ne.lat, neLng: ne.lng });
  };

  useMapEvents({ moveend: report });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  useEffect(report, []);

  return null;
}

export default function MapView({
  reports,
  center = PILOT_ZONE_CENTER,
  loading = false,
  onBoundsChange,
}: MapViewProps) {
  const reportsWithLocation = reports.filter((r) => r.location);
  // el mapa nunca se desmonta: si no, sin reportes en pantalla no habria como moverse a otra zona
  const status = loading
    ? "Buscando reportes…"
    : reportsWithLocation.length === 0
      ? "No hay reportes en esta zona del mapa"
      : null;

  return (
    // `isolate` encierra los z-index altos de Leaflet para que el mapa no se
    // dibuje por encima del header ni de la tab bar.
    <div className={`relative isolate animate-fade overflow-hidden rounded-card border border-line shadow-card ${MAP_HEIGHT}`}>
      {status && (
        <p
          role="status"
          className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full bg-paper px-4 py-2 text-sm text-ink-muted shadow-card ring-1 ring-line"
        >
          {status}
        </p>
      )}
      <MapContainer center={center} zoom={DEFAULT_MAP_ZOOM} className="h-full w-full">
        {onBoundsChange && <BoundsReporter onBoundsChange={onBoundsChange} />}
        <OsmTileLayer />
        {reportsWithLocation.map((report) => (
          <Marker
            key={report.id}
            position={[report.location!.lat, report.location!.lng]}
            icon={getReportPinIcon(report.reportType)}
          >
            <Popup>
              <div className="flex w-52 flex-col gap-2 font-sans">
                {report.imageUrl && (
                  <img
                    src={report.imageUrl}
                    alt={report.title}
                    width={208}
                    height={128}
                    loading="lazy"
                    className="h-32 w-full rounded-[10px] object-cover"
                  />
                )}
                <h4 className="font-display text-base font-bold leading-tight text-ink">{report.title}</h4>
                <p className="!m-0 line-clamp-2 text-sm text-ink-muted">
                  {report.description || "Sin descripción"}
                </p>
                <Link
                  to={`/reports/${report.id}`}
                  className="press mt-1 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-4 text-sm font-bold !text-white hover:bg-ink/85"
                >
                  Ver detalles
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
