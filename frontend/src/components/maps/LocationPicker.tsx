import { useCallback, useRef, useState } from "react";
import type { GeoPoint } from "@/types/geo.types";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Button from "@/components/ui/Button";
import { PinIcon } from "@/components/ui/icons";
import PinPickerMap from "./PinPickerMap";

interface LocationPickerProps {
  onLocationSelect: (location: GeoPoint, address: string) => void;
  // false: no consulta Nominatim y la etiqueta son las coordenadas
  resolveAddress?: boolean;
}

const REVERSE_GEOCODE_TIMEOUT_MS = 5000;

const formatCoords = ({ lat, lng }: GeoPoint) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Nominatim es un servicio publico de terceros: sin timeout, una respuesta
  // que nunca llega deja la promesa colgada para siempre.
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    { signal: AbortSignal.timeout(REVERSE_GEOCODE_TIMEOUT_MS) }
  );
  if (!response.ok) {
    throw new Error(`Nominatim respondió ${response.status}`);
  }
  const data = await response.json();
  return data.address?.city || data.address?.town || formatCoords({ lat, lng });
}

export default function LocationPicker({
  onLocationSelect,
  resolveAddress = true,
}: LocationPickerProps) {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [address, setAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // id de la ultima consulta a Nominatim: descarta respuestas de un pin viejo
  const lookupRef = useRef(0);

  const selectLocation = useCallback(
    async (loc: GeoPoint) => {
      const coordsLabel = formatCoords(loc);

      // Se avisa al formulario apenas se tiene la coordenada, no despues del
      // reverse geocoding. Antes el cartel "Ubicación seleccionada" aparecia
      // enseguida pero onLocationSelect recien corria al volver Nominatim:
      // en ese hueco el form seguia sin ubicación y, si el usuario apretaba
      // Crear, le rebotaba pidiendo la ubicación que la pantalla ya daba por
      // elegida. Si Nominatim se cuelga, el hueco es infinito.
      setLocation(loc);
      setAddress(coordsLabel);
      setError(null);
      onLocationSelect(loc, coordsLabel);

      if (!resolveAddress) return;
      const lookupId = ++lookupRef.current;

      // El nombre de la zona es una mejora sobre las coordenadas: si llega,
      // reemplaza la etiqueta; si falla, ya quedo algo utilizable.
      try {
        const addr = await reverseGeocode(loc.lat, loc.lng);
        if (lookupId !== lookupRef.current) return;
        setAddress(addr);
        onLocationSelect(loc, addr);
      } catch {
        // se mantiene coordsLabel
      }
    },
    [onLocationSelect, resolveAddress]
  );

  const handleGetCurrentLocation = () => {
    setIsLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocalización no disponible en tu navegador");
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLoading(false);
        void selectLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (err) => {
        setError(`Error de geolocalización: ${err.message}`);
        setIsLoading(false);
      }
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        Tocá el mapa para marcar el lugar y arrastrá el pin para ajustarlo.
      </p>
      <PinPickerMap value={location} onChange={selectLocation} />

      <Button
        type="button"
        variant="secondary"
        size="lg"
        isLoading={isLoading}
        onClick={handleGetCurrentLocation}
        className="w-full"
      >
        {!isLoading && <PinIcon className="h-5 w-5" />}
        Usar mi ubicación actual
      </Button>

      {location && (
        <div aria-live="polite" className="flex gap-3 rounded-card border border-line bg-surface p-3">
          <PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">Ubicación seleccionada</p>
            <p className="break-words text-ink">{address}</p>
            <p className="tabular text-sm text-ink-muted">{formatCoords(location)}</p>
          </div>
        </div>
      )}

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
