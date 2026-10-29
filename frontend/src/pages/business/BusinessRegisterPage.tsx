import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getApiErrorDetails } from "@/services/api";
import { useCreateBusinessMutation, useMyBusinessQuery } from "@/hooks/useBusiness";
import { buttonClasses } from "@/components/ui/buttonClasses";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LocationPicker from "@/components/maps/LocationPicker";
import type { BusinessCategory } from "@/types/business.types";
import type { GeoPoint } from "@/types/geo.types";

const CATEGORY_OPTIONS: Array<{ value: BusinessCategory; label: string }> = [
  { value: "VETERINARIA", label: "Veterinaria" },
  { value: "REFUGIO", label: "Refugio" },
  { value: "PET_SHOP", label: "Pet shop" },
  { value: "OTRO", label: "Otro" },
];

function BusinessRegisterPage() {
  const navigate = useNavigate();
  const myBusinessQuery = useMyBusinessQuery();
  const createBusiness = useCreateBusinessMutation();

  const [name, setName] = useState("");
  const [cuit, setCuit] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<BusinessCategory>("VETERINARIA");
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  if (myBusinessQuery.isSuccess) {
    return <Navigate to="/businesses/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors([]);

    if (!location) {
      setError("Marcá la ubicación del comercio en el mapa");
      return;
    }

    try {
      await createBusiness.mutateAsync({ name, cuit, address, phone, category, location });
      navigate("/businesses/dashboard");
    } catch (err) {
      const details = getApiErrorDetails(err);
      if (details && details.length > 0) {
        setFieldErrors(details.map((detail) => detail.message));
      } else {
        setError(err instanceof Error ? err.message : "Error inesperado, intentá de nuevo");
      }
    }
  }

  const isLoading = createBusiness.isPending;

  return (
    <div className="mx-auto max-w-lg px-4 py-5 sm:px-6 lg:py-8">
      <h1 className="font-display text-display-lg">Registrar comercio</h1>
      <p className="mt-2 max-w-prose text-ink-muted">
        Sumá tu veterinaria, refugio o pet shop al directorio de la comunidad.
      </p>
      <div className="mt-6 sm:card sm:p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="field-label">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              autoComplete="organization"
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cuit" className="field-label">
              CUIT
            </label>
            <input
              id="cuit"
              name="cuit"
              type="text"
              autoComplete="off"
              spellCheck={false}
              required
              value={cuit}
              onChange={(event) => setCuit(event.target.value)}
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="address" className="field-label">
              Domicilio
            </label>
            <input
              id="address"
              name="address"
              autoComplete="street-address"
              type="text"
              required
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="field"
            />
          </div>

          {/* el domicilio es texto libre: el mapa solo aporta las coordenadas */}
          <fieldset className="flex flex-col gap-2">
            <legend className="field-label mb-1.5">Ubicación en el mapa</legend>
            <LocationPicker onLocationSelect={setLocation} resolveAddress={false} />
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="field-label">
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className="field-label">
              Rubro
            </label>
            <select
              id="category"
              name="category"
              value={category}
              onChange={(event) => setCategory(event.target.value as BusinessCategory)}
              className="field"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* El plan no se elige al registrarse: el backend crea todo comercio en FREE (#179). */}
          <p className="text-sm text-ink-muted">
            Tu comercio arranca en el plan Gratis. Solo el plan Premium permite publicar anuncios.
          </p>

          {fieldErrors.length > 0 && (
            <ul role="alert" className="flex flex-col gap-1 border-l-4 border-danger pl-3 text-sm font-bold text-danger">
              {fieldErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          {error && <ErrorMessage message={error} />}

          <button
            type="submit"
            disabled={isLoading}
            className={buttonClasses("primary", "lg", "mt-2 w-full")}
          >
            {isLoading ? "Registrando..." : "Registrar comercio"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default BusinessRegisterPage;
