import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { hasNoBusiness, useMyBusinessQuery, usePlansQuery, useSubscribeMutation } from "@/hooks/useBusiness";
import { formatLongDate } from "@/lib/format";
import type { PlanOffer, SubscriptionPeriod } from "@/types/business.types";
import { buttonClasses } from "@/components/ui/buttonClasses";
import Button from "@/components/ui/Button";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Spinner from "@/components/ui/Spinner";
import { CheckIcon } from "@/components/ui/icons";

const PERIOD_LABELS: Record<SubscriptionPeriod, { name: string; unit: string }> = {
  MONTHLY: { name: "Mensual", unit: "por mes" },
  ANNUAL: { name: "Anual", unit: "por año" },
};

// beneficios de Premium (ADR-0024)
const PREMIUM_BENEFITS = [
  "Hasta 3 anuncios activos a la vez",
  "Anuncios segmentados por cercanía, con un radio de hasta 20 km",
  "Destacado en el directorio y entre los comercios cercanos a cada reporte",
  "Métricas de impresiones y clics de cada anuncio",
];

// ahorro del anual frente a pagar mes a mes
function annualSavings(offers: PlanOffer[]): number {
  const monthly = offers.find((offer) => offer.period === "MONTHLY");
  const annual = offers.find((offer) => offer.period === "ANNUAL");
  if (!monthly || !annual) return 0;
  return monthly.priceUsd * annual.months - annual.priceUsd;
}

function BusinessPlanPage() {
  const myBusinessQuery = useMyBusinessQuery();
  const plansQuery = usePlansQuery();
  const subscribe = useSubscribeMutation();
  const [period, setPeriod] = useState<SubscriptionPeriod>("MONTHLY");
  const [error, setError] = useState<string | null>(null);
  const [purchasedUntil, setPurchasedUntil] = useState<string | null>(null);

  if (myBusinessQuery.isLoading || plansQuery.isLoading) {
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
  const offers = plansQuery.data ?? [];
  if (!business) {
    return null;
  }

  const isPremium = business.plan === "PREMIUM";
  const savings = annualSavings(offers);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPurchasedUntil(null);
    try {
      const result = await subscribe.mutateAsync(period);
      setPurchasedUntil(result.business.planExpiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la compra, intentá de nuevo");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8">
      <h1 className="font-display text-display-lg">Plan Premium</h1>
      <p className="mt-2 max-w-prose text-ink-muted">
        Publicá anuncios de tus productos y servicios para las personas que buscan o encuentran mascotas cerca de tu
        comercio.
      </p>

      <section className="card mt-6 p-4 sm:p-5">
        <h2 className="font-display text-display-sm">Tu plan</h2>
        <p className="mt-2 text-ink">
          Plan:{" "}
          <span data-testid="current-plan" className="font-bold">
            {isPremium ? "Premium" : "Gratis"}
          </span>
        </p>
        {isPremium && business.planExpiresAt && (
          <p className="text-ink-muted">Vence: {formatLongDate(business.planExpiresAt)}</p>
        )}
      </section>

      <section className="card mt-4 p-4 sm:p-5">
        <h2 className="font-display text-display-sm">Qué incluye</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {PREMIUM_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-ink">
              <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-success-ink" />
              {benefit}
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="field-label mb-2">Elegí cómo pagar</legend>
          {offers.map((offer) => {
            const label = PERIOD_LABELS[offer.period];
            const checked = period === offer.period;
            return (
              <label
                key={offer.period}
                className={`card flex cursor-pointer flex-col gap-1 p-4 ${checked ? "ring-2 ring-ink" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="period"
                    value={offer.period}
                    checked={checked}
                    onChange={() => setPeriod(offer.period)}
                  />
                  <span className="font-bold">{label.name}</span>
                </span>
                <span className="font-display text-display-sm">
                  <span>USD {offer.priceUsd}</span> <span className="text-sm text-ink-muted">{label.unit}</span>
                </span>
                {offer.period === "ANNUAL" && savings > 0 && (
                  <span className="text-sm font-bold text-success-ink">Ahorrás USD {savings} frente al mensual</span>
                )}
              </label>
            );
          })}
        </fieldset>

        {isPremium && (
          <p className="text-sm text-ink-muted">El período que compres se suma a tu vencimiento actual.</p>
        )}

        {/* proveedor de pago simulado hasta integrar la pasarela (ADR-0024) */}
        <p className="rounded-control bg-surface p-3 text-sm text-ink-muted">
          Pago simulado: por ahora la plataforma no realiza ningún cobro. El plan se activa al confirmar.
        </p>

        {error && <ErrorMessage message={error} />}
        {purchasedUntil && (
          <p role="status" className="flex items-center gap-2 font-bold text-success-ink">
            <CheckIcon className="h-5 w-5" />
            Listo, tu plan Premium vence el {formatLongDate(purchasedUntil)}.
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={subscribe.isPending}>
          {isPremium ? "Renovar Premium" : "Pasar a Premium"}
        </Button>
      </form>

      <Link to="/businesses/dashboard" className={buttonClasses("secondary", "md", "mt-4 w-full")}>
        Volver al panel
      </Link>
    </div>
  );
}

export default BusinessPlanPage;
