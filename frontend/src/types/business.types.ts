export type BusinessCategory = 'VETERINARIA' | 'REFUGIO' | 'PET_SHOP' | 'OTRO'

// El backend conserva PRO en el enum de Prisma pero no lo expone como
// seleccionable: solo FREE/PREMIUM se pueden crear o actualizar vía API.
export type SelectableBusinessPlan = 'FREE' | 'PREMIUM'
export type BusinessPlan = SelectableBusinessPlan | 'PRO'

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

export interface CreateBusinessInput {
  name: string
  cuit: string
  address: string
  phone: string
  category: BusinessCategory
  plan?: SelectableBusinessPlan
}

export type UpdateBusinessInput = Partial<CreateBusinessInput>

export interface BusinessStats {
  views: number
  contacts: number
}
