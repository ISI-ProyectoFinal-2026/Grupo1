import { MapContainer, Marker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import type { ReportDTO } from "@/types/report.types";
import { MapIcon } from "@/components/ui/icons";
import OsmTileLayer from "@/components/maps/OsmTileLayer";
import { DEFAULT_MAP_ZOOM, PILOT_ZONE_CENTER } from "@/lib/map";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
  reports: ReportDTO[];
  center?: [number, number];
}

// Alto relativo a la pantalla: en un telefono el mapa ocupa casi toda la vista
// sin tapar la tab bar; en desktop llena el area de contenido.
const MAP_HEIGHT = "h-[60vh] min-h-[320px] lg:h-[calc(100vh-17rem)]";

export default function MapView({
  reports,
  center = PILOT_ZONE_CENTER,
}: MapViewProps) {
  const reportsWithLocation = reports.filter((r) => r.location);

  if (reportsWithLocation.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line px-6 text-center text-ink-muted">
        <MapIcon className="h-8 w-8" />
        <p>No hay reportes con ubicación para mostrar</p>
      </div>
    );
  }

  return (
    // `isolate` encierra los z-index altos de Leaflet para que el mapa no se
    // dibuje por encima del header ni de la tab bar.
    <div className={`isolate overflow-hidden rounded-card border border-line ${MAP_HEIGHT}`}>
      <MapContainer center={center} zoom={DEFAULT_MAP_ZOOM} className="h-full w-full">
        <OsmTileLayer />
        {reportsWithLocation.map((report) => (
          <Marker key={report.id} position={[report.location!.lat, report.location!.lng]}>
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
                  className="mt-1 inline-flex min-h-11 items-center justify-center rounded-control bg-ink px-3 text-sm font-bold !text-white hover:bg-ink/90"
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
