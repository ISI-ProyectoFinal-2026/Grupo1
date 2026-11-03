import { useCallback, useRef, useState } from "react";
import type { GeoPoint } from "@/types/geo.types";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Button from "@/components/ui/Button";
import { PinIcon } from "@/components/ui/icons";
import { reverseGeocode } from "@/services/geo.service";
import PinPickerMap from "./PinPickerMap";

interface LocationPickerProps {
  onLocationSelect: (location: GeoPoint, address: string) => void;
  // false: no consulta la geocodificacion inversa y la etiqueta son las coordenadas
  resolveAddress?: boolean;
  // ubicacion ya guardada (edicion): pin inicial hasta que se elija otra
  initialLocation?: GeoPoint | null;
  initialAddress?: string;
}

const REVERSE_GEOCODE_TIMEOUT_MS = 5000;

// Sin alta precision el navegador puede devolver una posicion aproximada por
// IP o Wi-Fi; maximumAge 0 evita reutilizar una lectura vieja.
const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};
// Por encima de este margen de error (metros) se avisa que el pin es aproximado
const LOW_ACCURACY_THRESHOLD_M = 100;
// GeolocationPositionError.TIMEOUT; la constante no existe en todos los entornos
const GEOLOCATION_TIMEOUT_CODE = 3;

const formatCoords = ({ lat, lng }: GeoPoint) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

async function resolveZone(lat: number, lng: number): Promise<string> {
  // La consulta pasa por el backend (proxy con cache, ADR-0025). Sin timeout,
  // una respuesta que nunca llega deja la promesa colgada para siempre.
  const zone = await reverseGeocode(lat, lng, AbortSignal.timeout(REVERSE_GEOCODE_TIMEOUT_MS));
  return zone ?? formatCoords({ lat, lng });
}

export default function LocationPicker({
  onLocationSelect,
  resolveAddress = true,
  initialLocation,
  initialAddress,
}: LocationPickerProps) {
  const [location, setLocation] = useState<GeoPoint | null>(initialLocation ?? null);
  const [address, setAddress] = useState<string>(initialAddress ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accuracyWarning, setAccuracyWarning] = useState<string | null>(null);
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
      setAccuracyWarning(null);
      onLocationSelect(loc, coordsLabel);

      if (!resolveAddress) return;
      const lookupId = ++lookupRef.current;

      // El nombre de la zona es una mejora sobre las coordenadas: si llega,
      // reemplaza la etiqueta; si falla, ya quedo algo utilizable.
      try {
        const addr = await resolveZone(loc.lat, loc.lng);
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
        // selectLocation limpia el aviso de forma sincrona: se setea despues
        const { accuracy } = position.coords;
        if (accuracy > LOW_ACCURACY_THRESHOLD_M) {
          setAccuracyWarning(
            `La ubicación es aproximada (±${Math.round(accuracy)} m). Ajustá el pin en el mapa para marcar el lugar exacto.`
          );
        }
      },
      (err) => {
        setError(
          err.code === GEOLOCATION_TIMEOUT_CODE
            ? "No pudimos obtener tu ubicación a tiempo. Probá de nuevo o marcala en el mapa."
            : `Error de geolocalización: ${err.message}`
        );
        setIsLoading(false);
      },
      GEOLOCATION_OPTIONS
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
            {address !== formatCoords(location) && <p className="break-words text-ink">{address}</p>}
            <p className="tabular text-sm text-ink-muted">{formatCoords(location)}</p>
          </div>
        </div>
      )}

      {accuracyWarning && (
        <p role="status" className="text-sm text-ink-muted">
          {accuracyWarning}
        </p>
      )}

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
