import { MapContainer, Marker } from "react-leaflet";
import type { GeoPoint } from "@/types/geo.types";
import type { ReportType } from "@/types/report.types";
import { getReportPinIcon } from "@/components/reports/reportPinIcon";
import OsmTileLayer from "./OsmTileLayer";
import "leaflet/dist/leaflet.css";

interface LocationMapProps {
  location: GeoPoint;
  label: string;
  reportType: ReportType;
}

const DETAIL_ZOOM = 15;

// mapa de solo lectura con un pin
export default function LocationMap({ location, label, reportType }: LocationMapProps) {
  const position: [number, number] = [location.lat, location.lng];

  return (
    // `isolate` encierra los z-index de Leaflet (ver MapView)
    <div className="isolate h-64 overflow-hidden rounded-card border border-line sm:h-80">
      <MapContainer center={position} zoom={DETAIL_ZOOM} scrollWheelZoom={false} className="h-full w-full">
        <OsmTileLayer />
        <Marker position={position} icon={getReportPinIcon(reportType)} title={label} alt={label} />
      </MapContainer>
    </div>
  );
}
