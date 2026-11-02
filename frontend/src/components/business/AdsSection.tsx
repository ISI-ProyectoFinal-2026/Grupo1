import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useCreateAdMutation,
  useDeleteAdMutation,
  useMyAdsQuery,
  useSetAdStatusMutation,
  useUpdateAdMutation,
} from "@/hooks/useAds";
import AdForm from "@/components/business/AdForm";
import AdStatsPanel from "@/components/business/AdStatsPanel";
import Button from "@/components/ui/Button";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Spinner from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { MAX_ACTIVE_ADS, type Ad, type AdInput } from "@/types/ad.types";
import type { Business } from "@/types/business.types";

const STATUS_LABELS: Record<Ad["status"], string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  REMOVED: "Dado de baja por moderación",
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Error inesperado, intentá de nuevo";
}

interface AdCardProps {
  ad: Ad;
  canActivate: boolean;
}

function AdCard({ ad, canActivate }: AdCardProps) {
  const updateAd = useUpdateAdMutation();
  const setStatus = useSetAdStatusMutation();
  const deleteAd = useDeleteAdMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRemoved = ad.status === "REMOVED";
  const titleId = `ad-${ad.id}-title`;

  async function handleUpdate(input: AdInput) {
    await updateAd.mutateAsync({ id: ad.id, input });
    setIsEditing(false);
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <article aria-labelledby={titleId} className="flex flex-col gap-3 rounded-control border border-line p-3">
      {/* 16:9, como en el banner: no recorta los anuncios apaisados */}
      <img src={ad.imageUrl} alt="" className="aspect-video w-full rounded-control border border-line object-cover" />
      <div>
        <div className="min-w-0">
          <h3 id={titleId} className="break-words font-bold text-ink">
            {ad.title}
          </h3>
          <p className="break-words text-sm text-ink-muted">{ad.body}</p>
          <p className="mt-1 text-sm text-ink-muted">
            <span className="font-bold text-ink">{STATUS_LABELS[ad.status]}</span> · Radio {ad.radiusKm} km
          </p>
        </div>
      </div>

      {isEditing ? (
        <AdForm ad={ad} isPending={updateAd.isPending} onSubmit={handleUpdate} onCancel={() => setIsEditing(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {!isRemoved && (
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
              Editar
            </Button>
          )}
          {ad.status === "ACTIVE" && (
            <Button
              variant="secondary"
              size="sm"
              isLoading={setStatus.isPending}
              onClick={() => run(() => setStatus.mutateAsync({ id: ad.id, status: "PAUSED" }))}
            >
              Pausar
            </Button>
          )}
          {ad.status === "PAUSED" && (
            <Button
              variant="secondary"
              size="sm"
              isLoading={setStatus.isPending}
              disabled={!canActivate}
              onClick={() => run(() => setStatus.mutateAsync({ id: ad.id, status: "ACTIVE" }))}
            >
              Activar
            </Button>
          )}
          <Button variant="ghost" size="sm" aria-expanded={showStats} onClick={() => setShowStats(!showStats)}>
            {showStats ? "Ocultar métricas" : "Ver métricas"}
          </Button>
          {isConfirmingDelete ? (
            <>
              <Button
                variant="danger"
                size="sm"
                isLoading={deleteAd.isPending}
                onClick={() => run(() => deleteAd.mutateAsync(ad.id))}
              >
                Confirmar eliminación
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsConfirmingDelete(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setIsConfirmingDelete(true)}>
              Eliminar
            </Button>
          )}
        </div>
      )}

      {error && <ErrorMessage message={error} />}
      {showStats && <AdStatsPanel ad={ad} />}
    </article>
  );
}

interface AdsSectionProps {
  business: Business;
}

// anuncios del comercio (plan Premium, ADR-0024)
function AdsSection({ business }: AdsSectionProps) {
  const adsQuery = useMyAdsQuery();
  const createAd = useCreateAdMutation();
  const [isCreating, setIsCreating] = useState(false);

  const isPremium = business.plan === "PREMIUM";
  const hasLocation = business.latitude !== null && business.longitude !== null;
  const ads = adsQuery.data ?? [];
  const activeCount = ads.filter((ad) => ad.status === "ACTIVE").length;
  // hasta tener el listado no se sabe cuántos activos hay
  const canActivate = adsQuery.isSuccess && isPremium && hasLocation && activeCount < MAX_ACTIVE_ADS;

  async function handleCreate(input: AdInput) {
    await createAd.mutateAsync(input);
    setIsCreating(false);
  }

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="font-display text-display-sm">Anuncios</h2>

      {!isPremium && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-ink-muted">
            Los anuncios son parte del plan Premium: se muestran a quienes buscan o encuentran mascotas cerca de tu
            comercio.
          </p>
          {activeCount > 0 && (
            <p className="font-bold text-ink">
              Tus anuncios no se muestran porque tu plan Premium venció. Vuelven a mostrarse al renovar.
            </p>
          )}
          <Link to="/businesses/plan" className={buttonClasses("primary", "md", "w-full")}>
            Ver plan Premium
          </Link>
        </div>
      )}

      {isPremium && !hasLocation && (
        <p className="mt-2 font-bold text-ink">
          Cargá la ubicación del comercio en el mapa (Datos del comercio) para publicar anuncios: el alcance se mide
          desde ahí.
        </p>
      )}

      {isPremium && hasLocation && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="tabular text-ink">
            {activeCount} de {MAX_ACTIVE_ADS} anuncios activos
          </p>
          {activeCount >= MAX_ACTIVE_ADS && (
            <p className="text-sm text-ink-muted">Llegaste al máximo. Pausá uno para publicar otro.</p>
          )}
          {isCreating ? (
            <AdForm isPending={createAd.isPending} onSubmit={handleCreate} onCancel={() => setIsCreating(false)} />
          ) : (
            <Button variant="primary" disabled={!canActivate} onClick={() => setIsCreating(true)}>
              Nuevo anuncio
            </Button>
          )}
        </div>
      )}

      {adsQuery.isLoading && (
        <div className="flex justify-center py-4 text-ink-muted">
          <Spinner />
        </div>
      )}
      {adsQuery.isError && <ErrorMessage message="No se pudieron cargar los anuncios" className="mt-3" />}

      {ads.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {ads.map((ad) => (
            <AdCard key={ad.id} ad={ad} canActivate={canActivate} />
          ))}
        </div>
      )}
    </section>
  );
}

export default AdsSection;
