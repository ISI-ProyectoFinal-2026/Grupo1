import { useState } from "react";
import type { ReportLocation } from "@/types/report.types";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Button from "@/components/ui/Button";
import { PinIcon } from "@/components/ui/icons";

interface LocationPickerProps {
  onLocationSelect: (location: ReportLocation, address: string) => void;
}

export default function LocationPicker({ onLocationSelect }: LocationPickerProps) {
  const [location, setLocation] = useState<ReportLocation | null>(null);
  const [address, setAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetCurrentLocation = () => {
    setIsLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocalización no disponible en tu navegador");
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const loc = { lat: latitude, lng: longitude };
        const coordsLabel = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

        // Se avisa al formulario apenas se tiene la coordenada, no despues del
        // reverse geocoding. Antes el cartel "Ubicación seleccionada" aparecia
        // enseguida pero onLocationSelect recien corria al volver Nominatim:
        // en ese hueco el form seguia sin ubicación y, si el usuario apretaba
        // Crear, le rebotaba pidiendo la ubicación que la pantalla ya daba por
        // elegida. Si Nominatim se cuelga, el hueco es infinito.
        setLocation(loc);
        setAddress(coordsLabel);
        onLocationSelect(loc, coordsLabel);
        setIsLoading(false);

        // El nombre de la zona es una mejora sobre las coordenadas: si llega,
        // reemplaza la etiqueta; si falla, ya quedo algo utilizable.
        try {
          const addr = await reverseGeocode(latitude, longitude);
          setAddress(addr);
          onLocationSelect(loc, addr);
        } catch {
          // se mantiene coordsLabel
        }
      },
      (err) => {
        setError(`Error de geolocalización: ${err.message}`);
        setIsLoading(false);
      }
    );
  };

  const REVERSE_GEOCODE_TIMEOUT_MS = 5000;

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
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
    return data.address?.city || data.address?.town || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  return (
    <div className="flex flex-col gap-3">
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
            <p className="tabular text-sm text-ink-muted">
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </p>
          </div>
        </div>
      )}

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
