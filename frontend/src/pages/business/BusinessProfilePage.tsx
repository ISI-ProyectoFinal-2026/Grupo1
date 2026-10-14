import { Link, useParams } from "react-router-dom";
import { useBusinessQuery, useContactBusinessMutation } from "@/hooks/useBusiness";
import type { BusinessCategory } from "@/types/business.types";
import { buttonClasses } from "@/components/ui/buttonClasses";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Spinner from "@/components/ui/Spinner";
import { CheckIcon, ChevronLeftIcon, PhoneIcon, PinIcon, StoreIcon } from "@/components/ui/icons";

const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  VETERINARIA: "Veterinaria",
  REFUGIO: "Refugio",
  PET_SHOP: "Pet shop",
  OTRO: "Otro",
};

function BusinessProfilePage() {
  const { id } = useParams<{ id: string }>();
  const businessId = id ? Number(id) : undefined;

  // El GET del perfil registra la visita (evento VIEW) del lado del backend.
  const { data: business, isLoading, isError } = useBusinessQuery(businessId);
  const contactMutation = useContactBusinessMutation();

  const backLink = (
    <Link
      to="/businesses"
      className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 font-bold text-ink-muted transition-colors hover:text-ink"
    >
      <ChevronLeftIcon className="h-5 w-5" />
      Volver al directorio
    </Link>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-ink-muted">
        <Spinner size="sm" />
        Cargando comercio…
      </div>
    );
  }

  if (isError || !business) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
        {backLink}
        <ErrorMessage message="No se pudo cargar el comercio." className="mt-4" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-6 pt-2 sm:px-6 lg:py-6">
      {backLink}

      <article className="card mt-2 p-5 sm:p-7">
        <span className="grid h-14 w-14 place-items-center rounded-card bg-signal text-ink">
          <StoreIcon className="h-7 w-7" />
        </span>
        <h1 className="mt-4 break-words font-display text-display-lg">{business.name}</h1>
        <p className="mt-1 font-bold text-ink-muted">{CATEGORY_LABELS[business.category]}</p>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex gap-3">
            <PinIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
            <div className="min-w-0">
              <dt className="text-sm text-ink-muted">Domicilio</dt>
              <dd className="break-words font-bold text-ink">{business.address}</dd>
            </div>
          </div>
          <div className="flex gap-3">
            <PhoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
            <div>
              <dt className="text-sm text-ink-muted">Teléfono</dt>
              <dd className="tabular font-bold text-ink">{business.phone}</dd>
            </div>
          </div>
        </dl>

        <div className="mt-6 border-t border-line pt-6" aria-live="polite">
          {contactMutation.isSuccess ? (
            <p className="flex items-start gap-2 font-bold text-success-ink">
              <CheckIcon className="mt-0.5 h-5 w-5 shrink-0" />
              ¡Listo! Registramos tu interés. Podés comunicarte al {business.phone}.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => contactMutation.mutate(business.id)}
              disabled={contactMutation.isPending}
              className={buttonClasses("primary", "lg", "w-full sm:w-auto")}
            >
              {contactMutation.isPending ? "Contactando..." : "Contactar"}
            </button>
          )}
          {contactMutation.isError && (
            <ErrorMessage message="No se pudo registrar el contacto, intentá de nuevo." className="mt-3" />
          )}
        </div>
      </article>
    </div>
  );
}

export default BusinessProfilePage;
