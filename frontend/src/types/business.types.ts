export type BusinessCategory = 'VETERINARIA' | 'REFUGIO' | 'PET_SHOP' | 'OTRO'

// El plan no se elige vía API: todo comercio nace FREE y ni el alta ni la
// edición aceptan `plan` (#179). El cambio de plan pertenece al futuro flujo de
// pago. PRO existe en el enum de Prisma pero queda sin uso.
export type BusinessPlan = 'FREE' | 'PREMIUM' | 'PRO'

export interface Business {
  id: number
  userId: number
  name: string
  cuit: string
  address: string
  phone: string
  category: BusinessCategory
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
  plan: BusinessPlan
  createdAt: string
}

export interface CreateBusinessInput {
  name: string
  cuit: string
  address: string
  phone: string
  category: BusinessCategory
}

export type UpdateBusinessInput = Partial<CreateBusinessInput>

export interface BusinessStats {
  views: number
  contacts: number
}
