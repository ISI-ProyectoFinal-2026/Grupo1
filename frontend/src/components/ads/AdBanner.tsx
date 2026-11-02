import { useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import { useFlagAd, useServedAdQuery } from "@/hooks/useServedAds";
import { recordAdEvent } from "@/services/ads.service";
import FlagReportForm from "@/components/reports/FlagReportForm";
import type { AdPlacement, ServedAd } from "@/types/ad.types";

// impresión una vez por sesión, anuncio y ubicación (sin datos del usuario, ADR-0024)
function impressionKey(adId: number, placement: AdPlacement): string {
  return `ad-impression:${adId}:${placement}`;
}

function wasSeen(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function markSeen(key: string): void {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // sin storage: se cuenta igual, el rate limit del backend acota
  }
}

// las métricas nunca rompen la navegación
function track(adId: number, type: "impression" | "click", placement: AdPlacement): void {
  recordAdEvent(adId, type, placement).catch(() => undefined);
}

function FlagAd({ adId }: { adId: number }) {
  const inputId = useId();
  const flag = useFlagAd(adId);
  return (
    <FlagReportForm
      onSubmit={flag.flag}
      isPending={flag.isPending}
      isSent={flag.isSent}
      isDone={flag.isDone}
      error={flag.error}
      inputId={inputId}
      triggerLabel="Denunciar anuncio"
      formLabel="Denunciar anuncio"
      placeholder="Ej: promociona algo engañoso…"
    />
  );
}

function AdCardContent({ ad, placement }: { ad: ServedAd; placement: AdPlacement }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const key = impressionKey(ad.id, placement);
    if (wasSeen(key)) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    // cuenta cuando el banner entra en pantalla, no al cargar la página
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || wasSeen(key)) return;
      markSeen(key);
      track(ad.id, "impression", placement);
      observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ad.id, placement]);

  return (
    <aside ref={ref} aria-label="Publicidad" className="card flex h-full flex-col gap-3 overflow-hidden p-3">
      <span className="self-start rounded-full bg-surface px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
        Publicidad
      </span>
      <Link
        to={`/businesses/${ad.business.id}`}
        onClick={() => track(ad.id, "click", placement)}
        className="flex flex-col gap-2 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25"
      >
        <img src={ad.imageUrl} alt="" className="aspect-video w-full rounded-control border border-line object-cover" />
        <span className="break-words font-display text-display-sm text-ink">{ad.title}</span>
        <span className="break-words text-sm text-ink">{ad.body}</span>
        <span className="text-sm font-bold text-ink-muted">{ad.business.name}</span>
      </Link>
      {!ad.isOwn && <FlagAd adId={ad.id} />}
    </aside>
  );
}

interface AdBannerProps {
  placement: AdPlacement;
  reportId?: number;
  // dentro de una lista: el <li> solo existe si hay anuncio, sin dejar huecos
  asListItem?: boolean;
}

// banner de publicidad; sin anuncio o con error no ocupa lugar
function AdBanner({ placement, reportId, asListItem = false }: AdBannerProps) {
  const adQuery = useServedAdQuery(placement, reportId);
  if (!adQuery.data) return null;
  const banner = <AdCardContent ad={adQuery.data} placement={placement} />;
  return asListItem ? <li>{banner}</li> : banner;
}

export default AdBanner;
