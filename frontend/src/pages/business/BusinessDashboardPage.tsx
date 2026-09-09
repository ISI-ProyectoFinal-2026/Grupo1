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
import type { Business, BusinessCategory, SelectableBusinessPlan } from "@/types/business.types";

const CATEGORY_OPTIONS: Array<{ value: BusinessCategory; label: string }> = [
  { value: "VETERINARIA", label: "Veterinaria" },
  { value: "REFUGIO", label: "Refugio" },
  { value: "PET_SHOP", label: "Pet shop" },
  { value: "OTRO", label: "Otro" },
];

const PLAN_OPTIONS: Array<{ value: SelectableBusinessPlan; label: string }> = [
  { value: "FREE", label: "Gratis" },
  { value: "PREMIUM", label: "Premium" },
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
  // El plan solo puede editarse a FREE/PREMIUM: PRO queda excluido del selector.
  const [plan, setPlan] = useState<SelectableBusinessPlan>(
    business.plan === "PREMIUM" ? "PREMIUM" : "FREE",
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors([]);
    setSuccess(false);

    try {
      await updateBusiness.mutateAsync({ name, address, phone, category, plan });
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

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="cuit" className="text-sm font-medium text-gray-700">
          CUIT
        </label>
        <input
          id="cuit"
          type="text"
          value={business.cuit}
          disabled
          className="rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-gray-700">
          Nombre
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="address" className="text-sm font-medium text-gray-700">
          Domicilio
        </label>
        <input
          id="address"
          type="text"
          required
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium text-gray-700">
          Teléfono
        </label>
        <input
          id="phone"
          type="text"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-sm font-medium text-gray-700">
          Rubro
        </label>
        <select
          id="category"
          value={category}
          onChange={(event) => setCategory(event.target.value as BusinessCategory)}
          className="rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="plan" className="text-sm font-medium text-gray-700">
          Plan
        </label>
        <select
          id="plan"
          value={plan}
          onChange={(event) => setPlan(event.target.value as SelectableBusinessPlan)}
          className="rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none"
        >
          {PLAN_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">Solo el plan Premium permite publicar anuncios.</p>
      </div>

      {fieldErrors.length > 0 && (
        <ul className="list-inside list-disc text-sm text-red-600">
          {fieldErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Cambios guardados</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
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
    return <div className="p-6">Cargando...</div>;
  }

  if (myBusinessQuery.isError) {
    if (hasNoBusiness(myBusinessQuery.error)) {
      return <Navigate to="/businesses/register" replace />;
    }
    return <div className="p-6 text-sm text-red-600">No se pudo cargar el comercio</div>;
  }

  const business = myBusinessQuery.data;
  if (!business) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Panel del comercio</h1>
        <p className="mt-1 text-sm text-gray-600">{business.name}</p>

        <section className="mt-6 rounded border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700">Estadísticas</h2>
          <dl className="mt-2 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-gray-500">Vistas</dt>
              <dd data-testid="stat-views" className="text-2xl font-bold text-gray-900">
                {statsQuery.data?.views ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Contactos</dt>
              <dd data-testid="stat-contacts" className="text-2xl font-bold text-gray-900">
                {statsQuery.data?.contacts ?? "-"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-4 rounded border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700">Suscripción</h2>
          <p className="mt-2 text-sm text-gray-900">
            Plan: <span data-testid="current-plan">{PLAN_LABELS[business.plan] ?? business.plan}</span>
          </p>
          {business.planExpiresAt && (
            <p className="text-sm text-gray-600">Vence: {formatDate(business.planExpiresAt)}</p>
          )}
        </section>

        <BusinessEditForm business={business} />
      </div>
    </div>
  );
}

export default BusinessDashboardPage;
