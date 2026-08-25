import { useState } from "react";
import type { ReportLocation } from "@/types/report.types";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Button from "@/components/ui/Button";

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
        setLocation(loc);

        try {
          const addr = await reverseGeocode(latitude, longitude);
          setAddress(addr);
          onLocationSelect(loc, addr);
        } catch {
          setAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          onLocationSelect(loc, `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setIsLoading(false);
      },
      (err) => {
        setError(`Error de geolocalización: ${err.message}`);
        setIsLoading(false);
      }
    );
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    const data = await response.json();
    return data.address?.city || data.address?.town || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        isLoading={isLoading}
        onClick={handleGetCurrentLocation}
      >
        📍 Usar mi ubicación actual
      </Button>

      {location && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-medium text-gray-900">Ubicación seleccionada</p>
          <p className="text-sm text-gray-600">{address}</p>
          <p className="text-xs text-gray-500">
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </p>
        </div>
      )}

      {error && <ErrorMessage message={error} />}
    </div>
  );
}
