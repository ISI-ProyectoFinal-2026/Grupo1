import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import type { LeafletEventHandlerFnMap } from "leaflet";
import type { GeoPoint } from "@/types/geo.types";
import { DEFAULT_MAP_ZOOM, PILOT_ZONE_CENTER } from "@/lib/map";
import OsmTileLayer from "./OsmTileLayer";
import "leaflet/dist/leaflet.css";

interface PinPickerMapProps {
  value: GeoPoint | null;
  onChange: (point: GeoPoint) => void;
}

// zoom minimo para ajustar el pin a nivel de cuadra
const PICK_ZOOM = 16;

function PickOnClick({ onPick }: { onPick: (point: GeoPoint) => void }) {
  useMapEvents({ click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

// acerca el mapa al pin si quedo fuera de vista o con poco zoom
function FollowPin({ value }: { value: GeoPoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (!value) return;
    const position: [number, number] = [value.lat, value.lng];
    if (map.getZoom() < PICK_ZOOM || !map.getBounds().contains(position)) {
      map.setView(position, Math.max(map.getZoom(), PICK_ZOOM));
    }
  }, [map, value]);
  return null;
}

// mapa con un pin que se coloca con un click y se ajusta arrastrandolo
export default function PinPickerMap({ value, onChange }: PinPickerMapProps) {
  // con pin inicial (edicion) el mapa arranca centrado en el
  const [initialView] = useState(() =>
    value
      ? { center: [value.lat, value.lng] as [number, number], zoom: PICK_ZOOM }
      : { center: PILOT_ZONE_CENTER, zoom: DEFAULT_MAP_ZOOM }
  );
  const pinEvents = useMemo<LeafletEventHandlerFnMap>(
    () => ({
      dragend: (event) => {
        const { lat, lng } = event.target.getLatLng();
        onChange({ lat, lng });
      },
    }),
    [onChange]
  );

  return (
    // `isolate` encierra los z-index de Leaflet (ver MapView)
    <div className="isolate h-72 overflow-hidden rounded-card border border-line">
      <MapContainer
        center={initialView.center}
        zoom={initialView.zoom}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <OsmTileLayer />
        <PickOnClick onPick={onChange} />
        <FollowPin value={value} />
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            draggable
            title="Ubicación elegida"
            alt="Ubicación elegida"
            eventHandlers={pinEvents}
          />
        )}
      </MapContainer>
    </div>
  );
}
