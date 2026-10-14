import { useState } from "react";
import { Link } from "react-router-dom";
import { useBusinessesQuery } from "@/hooks/useBusiness";
import type { BusinessCategory } from "@/types/business.types";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Spinner from "@/components/ui/Spinner";
import { PinIcon, StoreIcon } from "@/components/ui/icons";

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
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:py-8">
      <h1 className="font-display text-display-lg">Comercios</h1>
      <p className="mt-2 max-w-prose text-ink-muted">
        Veterinarias, refugios y pet shops de la comunidad.
      </p>

      <div className="mt-5 flex max-w-xs flex-col gap-1.5">
        <label htmlFor="category-filter" className="field-label">
          Rubro
        </label>
        <select
          id="category-filter"
          value={category}
          onChange={(event) => setCategory(event.target.value as BusinessCategory | "all")}
          className="field"
        >
          {CATEGORY_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6" aria-live="polite">
        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-ink-muted">
            <Spinner size="sm" />
            Cargando comercios…
          </div>
        ) : isError ? (
          <ErrorMessage message="No se pudieron cargar los comercios, intentá de nuevo." />
        ) : !businesses || businesses.length === 0 ? (
          <p className="rounded-card border border-dashed border-line px-4 py-10 text-center text-ink-muted">
            No hay comercios registrados todavía.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((business) => (
              <li key={business.id}>
                <Link
                  to={`/businesses/${business.id}`}
                  className="card flex h-full items-start gap-3 p-4 transition-colors hover:border-ink-muted"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-surface text-ink">
                    <StoreIcon className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="break-words font-display text-display-sm text-ink">{business.name}</h2>
                    <p className="mt-0.5 text-sm font-bold text-ink-muted">{CATEGORY_LABELS[business.category]}</p>
                    <p className="mt-1 flex items-start gap-1 text-sm text-ink-muted">
                      <PinIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="break-words">{business.address}</span>
                    </p>
                  </div>
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
