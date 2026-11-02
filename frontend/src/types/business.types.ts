import type { GeoPoint } from './geo.types'

export type BusinessCategory = 'VETERINARIA' | 'REFUGIO' | 'PET_SHOP' | 'OTRO'

// Plan vigente: el backend ya informa FREE si el Premium venció. Solo cambia
// con una compra (POST /businesses/me/subscription), nunca al editar (ADR-0024).
export type BusinessPlan = 'FREE' | 'PREMIUM'

export type SubscriptionPeriod = 'MONTHLY' | 'ANNUAL'

// precios de GET /plans
export interface PlanOffer {
  plan: 'PREMIUM'
  period: SubscriptionPeriod
  months: number
  priceUsd: number
}

export interface Subscription {
  id: number
  period: SubscriptionPeriod
  amountUsd: number
  status: 'APPROVED' | 'REJECTED'
  provider: string
}

export interface SubscribeResult {
  business: Business
  subscription: Subscription
}

export interface Business {
  id: number
  userId: number
  name: string
  cuit: string
  address: string
  phone: string
  category: BusinessCategory
  // pin del mapa (#208); null en comercios previos
  latitude: number | null
  longitude: number | null
  // perfil público (ADR-0024)
  description: string | null
  website: string | null
  socialLinks: string[]
  plan: BusinessPlan
  planExpiresAt: string | null
  createdAt: string
}

// Proyección pública de un comercio (GET /businesses y GET /businesses/:id).
// El backend deja afuera `cuit` y `userId`: son datos del titular y solo se
// devuelven al dueño por GET /me (ver businesses.service.ts, publicBusinessSelect).
export interface PublicBusiness {
  id: number
  name: string
  address: string
  phone: string
  category: BusinessCategory
  description: string | null
  website: string | null
  socialLinks: string[]
  plan: BusinessPlan
  createdAt: string
}

export interface CreateBusinessInput {
  name: string
  cuit: string
  address: string
  phone: string
  category: BusinessCategory
  // pin del mapa (#208)
  location: GeoPoint
}

export type UpdateBusinessInput = Partial<CreateBusinessInput> & {
  description?: string | null
  website?: string | null
  socialLinks?: string[]
}

export interface BusinessStats {
  views: number
  contacts: number
}
