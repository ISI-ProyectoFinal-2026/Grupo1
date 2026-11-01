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
