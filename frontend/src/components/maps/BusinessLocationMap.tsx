import { MapContainer, Marker } from "react-leaflet";
import type { GeoPoint } from "@/types/geo.types";
import { businessPinIcon } from "./businessPinIcon";
import OsmTileLayer from "./OsmTileLayer";
import "leaflet/dist/leaflet.css";

interface BusinessLocationMapProps {
  location: GeoPoint;
  label: string;
}

const DETAIL_ZOOM = 15;

// mapa de solo lectura con el pin del comercio
export default function BusinessLocationMap({ location, label }: BusinessLocationMapProps) {
  const position: [number, number] = [location.lat, location.lng];

  return (
    // `isolate` encierra los z-index de Leaflet (ver MapView)
    <div className="isolate h-64 overflow-hidden rounded-card border border-line sm:h-80">
      <MapContainer center={position} zoom={DETAIL_ZOOM} scrollWheelZoom={false} className="h-full w-full">
        <OsmTileLayer />
        <Marker position={position} icon={businessPinIcon} title={label} alt={label} />
      </MapContainer>
    </div>
  );
}
