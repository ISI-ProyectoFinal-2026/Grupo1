import { useState } from "react";
import { Link } from "react-router-dom";
import { useBusinessesQuery } from "@/hooks/useBusiness";
import type { BusinessCategory } from "@/types/business.types";

const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  VETERINARIA: "Veterinaria",
  REFUGIO: "Refugio",
  PET_SHOP: "Pet shop",
  OTRO: "Otro",
};

const CATEGORY_FILTERS: Array<{ value: BusinessCategory | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "VETERINARIA", label: "Veterinaria" },
  { value: "REFUGIO", label: "Refugio" },
  { value: "PET_SHOP", label: "Pet shop" },
  { value: "OTRO", label: "Otro" },
];

function BusinessDirectoryPage() {
  const [category, setCategory] = useState<BusinessCategory | "all">("all");
  const { data: businesses, isLoading, isError } = useBusinessesQuery(
    category === "all" ? undefined : category,
  );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Comercios</h1>
      <p className="mt-1 text-sm text-gray-600">
        Veterinarias, refugios y pet shops de la comunidad.
      </p>

      <div className="mt-6 flex flex-col gap-1">
        <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
          Rubro
        </label>
        <select
          id="category-filter"
          value={category}
          onChange={(event) => setCategory(event.target.value as BusinessCategory | "all")}
          className="w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none"
        >
          {CATEGORY_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-gray-500">Cargando comercios...</p>
        ) : isError ? (
          <p className="text-sm text-red-600">No se pudieron cargar los comercios, intentá de nuevo.</p>
        ) : !businesses || businesses.length === 0 ? (
          <p className="text-sm text-gray-500">No hay comercios registrados todavía.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {businesses.map((business) => (
              <li key={business.id}>
                <Link
                  to={`/businesses/${business.id}`}
                  className="block rounded border border-gray-200 p-4 transition-shadow hover:shadow-md"
                >
                  <h2 className="font-semibold text-gray-900">{business.name}</h2>
                  <p className="mt-1 text-sm text-gray-600">{CATEGORY_LABELS[business.category]}</p>
                  <p className="mt-1 text-sm text-gray-500">{business.address}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default BusinessDirectoryPage;
