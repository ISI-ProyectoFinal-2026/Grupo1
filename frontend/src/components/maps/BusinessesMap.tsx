import { MapContainer, Marker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import { DEFAULT_MAP_ZOOM } from "@/lib/map";
import type { PublicBusiness } from "@/types/business.types";
import { businessPinIcon } from "./businessPinIcon";
import OsmTileLayer from "./OsmTileLayer";
import "leaflet/dist/leaflet.css";

interface BusinessesMapProps {
  businesses: PublicBusiness[];
}

type LocatedBusiness = PublicBusiness & { latitude: number; longitude: number };

function hasLocation(business: PublicBusiness): business is LocatedBusiness {
  return business.latitude !== null && business.longitude !== null;
}

// mapa de solo lectura con un pin por comercio ubicado
export default function BusinessesMap({ businesses }: BusinessesMapProps) {
  const located = businesses.filter(hasLocation);
  if (located.length === 0) return null;

  // centra en el primer comercio ubicado
  const center: [number, number] = [located[0].latitude, located[0].longitude];

  return (
    // `isolate` encierra los z-index de Leaflet (ver MapView)
    <div className="isolate h-72 overflow-hidden rounded-card border border-line shadow-card sm:h-96">
      <MapContainer center={center} zoom={DEFAULT_MAP_ZOOM} className="h-full w-full">
        <OsmTileLayer />
        {located.map((business) => (
          <Marker
            key={business.id}
            position={[business.latitude, business.longitude]}
            icon={businessPinIcon}
            title={business.name}
          >
            <Popup>
              <div className="flex w-44 flex-col gap-2 font-sans">
                <h4 className="font-display text-base font-bold leading-tight text-ink">{business.name}</h4>
                <Link
                  to={`/businesses/${business.id}`}
                  className="press inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-4 text-sm font-bold !text-white hover:bg-ink/85"
                >
                  Ver comercio
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
