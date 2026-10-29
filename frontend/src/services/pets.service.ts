import { api } from './api'
import type { CreatePetInput, PetDTO, UpdatePetInput } from '@/types/pet.types'

export async function listMyPets(): Promise<PetDTO[]> {
  const { data } = await api.get<PetDTO[]>('/pets')
  return data
}

export async function getPet(id: number): Promise<PetDTO> {
  const { data } = await api.get<PetDTO>(`/pets/${id}`)
  return data
}

export async function createPet(input: CreatePetInput): Promise<PetDTO> {
  const { data } = await api.post<PetDTO>('/pets', input)
  return data
}

export async function updatePet(id: number, input: UpdatePetInput): Promise<PetDTO> {
  const { data } = await api.put<PetDTO>(`/pets/${id}`, input)
  return data
}

export async function deletePet(id: number): Promise<void> {
  await api.delete(`/pets/${id}`)
}
