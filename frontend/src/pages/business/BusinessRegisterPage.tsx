import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getApiErrorDetails } from "@/services/api";
import { useCreateBusinessMutation, useMyBusinessQuery } from "@/hooks/useBusiness";
import type { BusinessCategory, SelectableBusinessPlan } from "@/types/business.types";

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

function BusinessRegisterPage() {
  const navigate = useNavigate();
  const myBusinessQuery = useMyBusinessQuery();
  const createBusiness = useCreateBusinessMutation();

  const [name, setName] = useState("");
  const [cuit, setCuit] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<BusinessCategory>("VETERINARIA");
  const [plan, setPlan] = useState<SelectableBusinessPlan>("FREE");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  if (myBusinessQuery.isSuccess) {
    return <Navigate to="/businesses/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors([]);

    try {
      await createBusiness.mutateAsync({ name, cuit, address, phone, category, plan });
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
    <div className="p-6">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Registrar comercio</h1>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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
            <label htmlFor="cuit" className="text-sm font-medium text-gray-700">
              CUIT
            </label>
            <input
              id="cuit"
              type="text"
              required
              value={cuit}
              onChange={(event) => setCuit(event.target.value)}
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

          <button
            type="submit"
            disabled={isLoading}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Registrando..." : "Registrar comercio"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default BusinessRegisterPage;
