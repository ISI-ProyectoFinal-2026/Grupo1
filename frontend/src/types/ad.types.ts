import type { BusinessCategory } from './business.types'

// ACTIVE/PAUSED los maneja el dueño; REMOVED = baja por moderación (ADR-0024)
export type AdStatus = 'ACTIVE' | 'PAUSED' | 'REMOVED'

export type AdPlacement = 'feed' | 'report_detail'

export interface Ad {
  id: number
  businessId: number
  title: string
  body: string
  imageUrl: string
  radiusKm: number
  status: AdStatus
  createdAt: string
  updatedAt: string
}

export interface AdInput {
  title: string
  body: string
  imageUrl: string
  radiusKm: number
}

export interface AdCounts {
  impressions: number
  clicks: number
}

// GET /businesses/me/ads/:id/stats: totales históricos y últimos 30 días
export interface AdStats extends AdCounts {
  ctr: number
  daily: (AdCounts & { date: string })[]
  byPlacement: (AdCounts & { placement: AdPlacement })[]
}

// límites del plan Premium (ADR-0024)
export const MAX_ACTIVE_ADS = 3
export const MIN_AD_RADIUS_KM = 1
export const MAX_AD_RADIUS_KM = 20
export const MAX_AD_TITLE_LENGTH = 60
export const MAX_AD_BODY_LENGTH = 200

// GET /ads: anuncio elegido para una ubicación de la plataforma
export interface ServedAd {
  id: number
  title: string
  body: string
  imageUrl: string
  business: { id: number; name: string; category: BusinessCategory }
  // false = sin ubicación de referencia o sin anuncios en el radio
  segmented: boolean
  // anuncio del propio usuario: no se le ofrece denunciarlo
  isOwn: boolean
}

// GET /reports/:id/nearby-businesses: Premium vigente primero (featured)
export interface NearbyBusiness {
  id: number
  name: string
  category: BusinessCategory
  address: string
  phone: string
  distanceKm: number
  featured: boolean
}

export type AdFlagStatus = 'pending' | 'removed' | 'dismissed'

// cola de moderación de anuncios (GET /ad-flags)
export interface AdFlagDTO {
  id: number
  adId: number
  userId: number
  reason: string
  status: AdFlagStatus
  createdAt: string
  ad: {
    id: number
    title: string
    body: string
    imageUrl: string
    status: AdStatus
    business: { id: number; name: string }
  }
}
