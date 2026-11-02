import { Link } from "react-router-dom";
import { useNearbyBusinessesQuery } from "@/hooks/useServedAds";
import FeaturedBadge from "@/components/business/FeaturedBadge";
import { PinIcon, StoreIcon } from "@/components/ui/icons";

const distance = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

interface NearbyBusinessesProps {
  reportId: number;
}

// comercios adheridos a hasta 20 km del reporte, Premium primero (ADR-0024)
function NearbyBusinesses({ reportId }: NearbyBusinessesProps) {
  const { data: businesses } = useNearbyBusinessesQuery(reportId);
  if (!businesses || businesses.length === 0) return null;

  return (
    <section className="card p-4">
      <h2 id={`nearby-${reportId}`} className="font-display text-display-sm">
        Comercios adheridos cerca
      </h2>
      <p className="mt-1 text-sm text-ink-muted">Veterinarias, refugios y pet shops cerca de donde se reportó.</p>
      <ul aria-labelledby={`nearby-${reportId}`} className="mt-3 flex flex-col gap-2">
        {businesses.map((business) => (
          <li key={business.id}>
            <Link
              to={`/businesses/${business.id}`}
              className="flex items-start gap-3 rounded-control p-2 transition-colors hover:bg-surface"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-surface text-ink">
                <StoreIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="break-words font-bold text-ink">{business.name}</span>
                  {business.featured && <FeaturedBadge />}
                </span>
                <span className="mt-0.5 flex items-start gap-1 text-sm text-ink-muted">
                  <PinIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="break-words">{business.address}</span>
                </span>
              </span>
              <span className="tabular shrink-0 text-sm text-ink-muted">a {distance.format(business.distanceKm)} km</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default NearbyBusinesses;
