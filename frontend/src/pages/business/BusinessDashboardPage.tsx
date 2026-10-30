import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { getApiErrorDetails } from "@/services/api";
import {
  hasNoBusiness,
  useMyBusinessQuery,
  useMyBusinessStatsQuery,
  useUpdateBusinessMutation,
} from "@/hooks/useBusiness";
import type { Business, BusinessCategory } from "@/types/business.types";
import type { GeoPoint } from "@/types/geo.types";
import LocationPicker from "@/components/maps/LocationPicker";
import { buttonClasses } from "@/components/ui/buttonClasses";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Spinner from "@/components/ui/Spinner";
import { CheckIcon } from "@/components/ui/icons";

const CATEGORY_OPTIONS: Array<{ value: BusinessCategory; label: string }> = [
  { value: "VETERINARIA", label: "Veterinaria" },
  { value: "REFUGIO", label: "Refugio" },
  { value: "PET_SHOP", label: "Pet shop" },
  { value: "OTRO", label: "Otro" },
];

const PLAN_LABELS: Record<string, string> = { FREE: "Gratis", PRO: "Pro", PREMIUM: "Premium" };

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface BusinessEditFormProps {
  business: Business;
}

function BusinessEditForm({ business }: BusinessEditFormProps) {
  const updateBusiness = useUpdateBusinessMutation();

  const [name, setName] = useState(business.name);
  const [address, setAddress] = useState(business.address);
  const [phone, setPhone] = useState(business.phone);
  const [category, setCategory] = useState<BusinessCategory>(business.category);
  // solo se envía si el dueño toca el pin; null conserva las coordenadas guardadas
  const [newLocation, setNewLocation] = useState<GeoPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors([]);
    setSuccess(false);

    try {
      // Sin `plan`: PUT /businesses/me lo ignora; el cambio de plan pertenece al flujo de pago.
      await updateBusiness.mutateAsync({
        name,
        address,
        phone,
        category,
        ...(newLocation && { location: newLocation }),
      });
      setSuccess(true);
    } catch (err) {
      const details = getApiErrorDetails(err);
      if (details && details.length > 0) {
        setFieldErrors(details.map((detail) => detail.message));
      } else {
        setError(err instanceof Error ? err.message : "Error inesperado, intentá de nuevo");
      }
    }
  }

  const isLoading = updateBusiness.isPending;
  const savedLocation: GeoPoint | null =
    business.latitude !== null && business.longitude !== null
      ? { lat: business.latitude, lng: business.longitude }
      : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cuit" className="field-label">
          CUIT
        </label>
        <input
          id="cuit"
          type="text"
          value={business.cuit}
          disabled
          className="field"
        />
      </div>

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
        <LocationPicker
          onLocationSelect={setNewLocation}
          resolveAddress={false}
          initialLocation={savedLocation}
        />
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

      {fieldErrors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 border-l-4 border-danger pl-3 text-sm font-bold text-danger">
          {fieldErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {error && <ErrorMessage message={error} />}
      {success && (
        <p role="status" className="flex items-center gap-2 font-bold text-success-ink">
          <CheckIcon className="h-5 w-5" />
          Cambios guardados
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className={buttonClasses("primary", "lg", "mt-2 w-full")}
      >
        {isLoading ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}

function BusinessDashboardPage() {
  const myBusinessQuery = useMyBusinessQuery();
  const statsQuery = useMyBusinessStatsQuery(myBusinessQuery.isSuccess);

  if (myBusinessQuery.isLoading) {
    return (
      <div className="flex justify-center py-16 text-ink-muted">
        <Spinner />
      </div>
    );
  }

  if (myBusinessQuery.isError) {
    if (hasNoBusiness(myBusinessQuery.error)) {
      return <Navigate to="/businesses/register" replace />;
    }
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <ErrorMessage message="No se pudo cargar el comercio" />
      </div>
    );
  }

  const business = myBusinessQuery.data;
  if (!business) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:py-8">
      <h1 className="font-display text-display-lg">Panel del comercio</h1>
      <p className="mt-1 text-lg text-ink-muted">{business.name}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <section className="card p-4 sm:p-5">
            <h2 className="font-display text-display-sm">Estadísticas</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-control bg-surface p-3">
                <dt className="text-sm text-ink-muted">Vistas</dt>
                <dd data-testid="stat-views" className="tabular font-display text-display-lg text-ink">
                  {statsQuery.data?.views ?? "-"}
                </dd>
              </div>
              <div className="rounded-control bg-surface p-3">
                <dt className="text-sm text-ink-muted">Contactos</dt>
                <dd data-testid="stat-contacts" className="tabular font-display text-display-lg text-ink">
                  {statsQuery.data?.contacts ?? "-"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card p-4 sm:p-5">
            <h2 className="font-display text-display-sm">Suscripción</h2>
            <p className="mt-2 text-ink">
              Plan: <span data-testid="current-plan" className="font-bold">{PLAN_LABELS[business.plan] ?? business.plan}</span>
            </p>
            {business.planExpiresAt && (
              <p className="text-ink-muted">Vence: {formatDate(business.planExpiresAt)}</p>
            )}
            <p className="mt-2 text-sm text-ink-muted">Solo el plan Premium permite publicar anuncios.</p>
          </section>
        </div>

        <section className="sm:card sm:p-5">
          <h2 className="mb-4 font-display text-display-sm">Datos del comercio</h2>
          <BusinessEditForm business={business} />
        </section>
      </div>
    </div>
  );
}

export default BusinessDashboardPage;
