import { BusinessCategory, Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import * as notificationPreferencesService from "./notification-preferences.service";
import * as reportsService from "./reports.service";

// bloque "Comercios adheridos cerca" del detalle del reporte
export const NEARBY_BUSINESSES_RADIUS_KM = 20;
export const NEARBY_BUSINESSES_LIMIT = 5;

export type AdPlacement = "feed" | "report_detail";

type Point = { lat: number; lng: number };

export interface ServedAd {
  id: number;
  title: string;
  body: string;
  imageUrl: string;
  business: { id: number; name: string; category: BusinessCategory };
  // false = sin punto de referencia o sin anuncios en el radio
  segmented: boolean;
}

export interface NearbyBusiness {
  id: number;
  name: string;
  category: BusinessCategory;
  address: string;
  phone: string;
  distanceKm: number;
  featured: boolean;
}

interface AdRow {
  id: number;
  title: string;
  body: string;
  imageUrl: string;
  businessId: number;
  businessName: string;
  businessCategory: BusinessCategory;
}

const businessPoint = Prisma.sql`ST_SetSRID(ST_MakePoint(b.longitude, b.latitude), 4326)::geography`;

const toGeography = (point: Point) =>
  Prisma.sql`ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography`;

// Premium vigente calculado en SQL, igual que getEffectivePlan (ADR-0024)
const isPremiumActive = Prisma.sql`(b.plan = 'PREMIUM'::business_plan AND b.plan_expires_at > now())`;

// elegibles: activo, Premium vigente y comercio con ubicación; rotación aleatoria
async function pickAd(point: Point | null): Promise<AdRow | null> {
  const inRadius = point
    ? Prisma.sql`AND ST_DWithin(${businessPoint}, ${toGeography(point)}, a.radius_km * 1000)`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<AdRow[]>`
    SELECT a.id, a.title, a.body, a.image_url AS "imageUrl",
           b.id AS "businessId", b.name AS "businessName", b.category AS "businessCategory"
    FROM ads a
    JOIN businesses b ON b.id = a.business_id
    WHERE a.status = 'ACTIVE'::ad_status
      AND ${isPremiumActive}
      AND b.latitude IS NOT NULL AND b.longitude IS NOT NULL
      ${inRadius}
    ORDER BY random()
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getReferencePoint(placement: AdPlacement, reportId?: number, viewerId?: number): Promise<Point | null> {
  if (placement === "report_detail") {
    return (await reportsService.getVisibleById(reportId!, viewerId)).location;
  }
  if (viewerId === undefined) {
    return null;
  }
  const preferences = await notificationPreferencesService.get(viewerId);
  if (preferences.locationConsentStatus !== "accepted" || !preferences.location) {
    return null;
  }
  return { lat: preferences.location.latitude, lng: preferences.location.longitude };
}

/**
 * Anuncio para una ubicación de la plataforma. Sin punto de referencia (usuario
 * sin ubicación consentida) o sin anuncios en el radio se sirve uno sin
 * segmentar: rechazar la ubicación no evita la publicidad (ADR-0024).
 */
export async function getAdFor(placement: AdPlacement, reportId?: number, viewerId?: number): Promise<ServedAd | null> {
  const point = await getReferencePoint(placement, reportId, viewerId);
  const segmented = point ? await pickAd(point) : null;
  const row = segmented ?? (await pickAd(null));
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    imageUrl: row.imageUrl,
    business: { id: row.businessId, name: row.businessName, category: row.businessCategory },
    segmented: segmented !== null,
  };
}

// todos los comercios con ubicación en el radio: Premium vigente primero, después por distancia
export async function getNearbyBusinesses(reportId: number, viewerId?: number): Promise<NearbyBusiness[]> {
  const { location } = await reportsService.getVisibleById(reportId, viewerId);
  if (!location) {
    return [];
  }
  const point = toGeography(location);
  const rows = await prisma.$queryRaw<(Omit<NearbyBusiness, "distanceKm"> & { distanceMeters: number })[]>`
    SELECT b.id, b.name, b.category, b.address, b.phone,
           ST_Distance(${businessPoint}, ${point}) AS "distanceMeters",
           ${isPremiumActive} AS featured
    FROM businesses b
    WHERE b.latitude IS NOT NULL AND b.longitude IS NOT NULL
      AND ST_DWithin(${businessPoint}, ${point}, ${NEARBY_BUSINESSES_RADIUS_KM * 1000})
    ORDER BY featured DESC, "distanceMeters" ASC
    LIMIT ${NEARBY_BUSINESSES_LIMIT}
  `;
  return rows.map(({ distanceMeters, ...business }) => ({
    ...business,
    distanceKm: Math.round(distanceMeters / 100) / 10,
  }));
}
