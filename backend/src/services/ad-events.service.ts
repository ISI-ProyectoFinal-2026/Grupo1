import { AdEventType, AdPlacement } from "@prisma/client";
import { prisma } from "../db/client";
import { AppError } from "../errors/app-error";
import { getOwnAd } from "./ads.service";
import { getEffectivePlan } from "./business-plan";

// ventana del desglose diario, en hora de Argentina
export const STATS_DAYS = 30;
const TIME_ZONE = "America/Argentina/Buenos_Aires";

const PLACEMENTS: AdPlacement[] = [AdPlacement.feed, AdPlacement.report_detail];

export interface AdCounts {
  impressions: number;
  clicks: number;
}

export interface AdStats extends AdCounts {
  ctr: number;
  daily: (AdCounts & { date: string })[];
  byPlacement: (AdCounts & { placement: AdPlacement })[];
}

/**
 * Solo suman los anuncios que se pueden mostrar (activo y Premium vigente). Los
 * eventos del propio dueño se descartan, como las visitas a su perfil.
 */
export async function record(adId: number, type: AdEventType, placement: AdPlacement, viewerId?: number): Promise<void> {
  const ad = await prisma.ad.findUnique({
    where: { id: adId },
    select: { status: true, business: { select: { userId: true, plan: true, planExpiresAt: true } } },
  });
  const servable =
    ad?.status === "ACTIVE" && getEffectivePlan(ad.business.plan, ad.business.planExpiresAt) === "PREMIUM";
  if (!ad || !servable) {
    throw new AppError(404, "Anuncio no encontrado");
  }
  if (viewerId !== undefined && viewerId === ad.business.userId) {
    return;
  }
  await prisma.adEvent.create({ data: { adId, type, placement } });
}

function countOf(rows: { type: AdEventType; _count: { _all: number } }[], type: AdEventType): number {
  return rows.filter((row) => row.type === type).reduce((sum, row) => sum + row._count._all, 0);
}

// totales de todo el historial; el diario cubre los últimos STATS_DAYS días
export async function getStats(userId: number, adId: number): Promise<AdStats> {
  const ad = await getOwnAd(userId, adId);

  const grouped = await prisma.adEvent.groupBy({
    by: ["placement", "type"],
    where: { adId: ad.id },
    _count: { _all: true },
  });
  const daily = await prisma.$queryRaw<(AdCounts & { date: string })[]>`
    SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
           count(e.id) FILTER (WHERE e.type = 'impression'::ad_event_type)::int AS impressions,
           count(e.id) FILTER (WHERE e.type = 'click'::ad_event_type)::int AS clicks
    FROM generate_series(
      (now() AT TIME ZONE ${TIME_ZONE})::date - ${STATS_DAYS - 1}::int,
      (now() AT TIME ZONE ${TIME_ZONE})::date,
      interval '1 day'
    ) AS d(day)
    LEFT JOIN ad_events e
      ON e.ad_id = ${ad.id}
     AND ((e.created_at AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE})::date = d.day::date
    GROUP BY d.day
    ORDER BY d.day
  `;

  const impressions = countOf(grouped, AdEventType.impression);
  const clicks = countOf(grouped, AdEventType.click);
  return {
    impressions,
    clicks,
    ctr: impressions === 0 ? 0 : Math.round((clicks / impressions) * 10_000) / 10_000,
    daily,
    byPlacement: PLACEMENTS.map((placement) => {
      const rows = grouped.filter((row) => row.placement === placement);
      return { placement, impressions: countOf(rows, AdEventType.impression), clicks: countOf(rows, AdEventType.click) };
    }),
  };
}
