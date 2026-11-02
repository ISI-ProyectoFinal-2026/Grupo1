import { useAdStatsQuery } from "@/hooks/useAds";
import { formatPercent, formatShortDay } from "@/lib/format";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Spinner from "@/components/ui/Spinner";
import type { Ad, AdPlacement } from "@/types/ad.types";

const PLACEMENT_LABELS: Record<AdPlacement, string> = {
  feed: "Feed",
  report_detail: "Detalle del reporte",
};

interface AdStatsPanelProps {
  ad: Ad;
}

// métricas de campaña: totales, por ubicación y por día (ADR-0024)
function AdStatsPanel({ ad }: AdStatsPanelProps) {
  const statsQuery = useAdStatsQuery(ad.id);

  if (statsQuery.isLoading) {
    return (
      <div className="flex justify-center py-4 text-ink-muted">
        <Spinner />
      </div>
    );
  }
  if (statsQuery.isError || !statsQuery.data) {
    return <ErrorMessage message="No se pudieron cargar las métricas" />;
  }

  const stats = statsQuery.data;
  const activeDays = stats.daily.filter((day) => day.impressions > 0 || day.clicks > 0).reverse();

  return (
    <section aria-label={`Métricas de ${ad.title}`} className="flex flex-col gap-4 rounded-control bg-surface p-4">
      <dl className="grid grid-cols-3 gap-2">
        <div>
          <dt className="text-sm text-ink-muted">Impresiones</dt>
          <dd data-testid="ad-impressions" className="tabular font-display text-display-sm">
            {stats.impressions}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Clics</dt>
          <dd data-testid="ad-clicks" className="tabular font-display text-display-sm">
            {stats.clicks}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Tasa de clics</dt>
          <dd data-testid="ad-ctr" className="tabular font-display text-display-sm">
            {formatPercent(stats.ctr)}
          </dd>
        </div>
      </dl>

      <table className="w-full text-sm">
        <caption className="mb-1 text-left font-bold">Por ubicación</caption>
        <thead>
          <tr className="text-left text-ink-muted">
            <th scope="col" className="font-normal">Ubicación</th>
            <th scope="col" className="text-right font-normal">Impresiones</th>
            <th scope="col" className="text-right font-normal">Clics</th>
          </tr>
        </thead>
        <tbody>
          {stats.byPlacement.map((row) => (
            <tr key={row.placement}>
              <td>{PLACEMENT_LABELS[row.placement]}</td>
              <td className="tabular text-right">{row.impressions}</td>
              <td className="tabular text-right">{row.clicks}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {activeDays.length === 0 ? (
        <p className="text-sm text-ink-muted">Sin actividad en los últimos 30 días.</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="mb-1 text-left font-bold">Últimos 30 días</caption>
          <thead>
            <tr className="text-left text-ink-muted">
              <th scope="col" className="font-normal">Día</th>
              <th scope="col" className="text-right font-normal">Impresiones</th>
              <th scope="col" className="text-right font-normal">Clics</th>
            </tr>
          </thead>
          <tbody>
            {activeDays.map((day) => (
              <tr key={day.date}>
                <td>{formatShortDay(day.date)}</td>
                <td className="tabular text-right">{day.impressions}</td>
                <td className="tabular text-right">{day.clicks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default AdStatsPanel;
