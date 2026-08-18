import { api } from "./api";
import type { CreatePetInput, Pet, UpdatePetInput } from "../types/pet";

export async function getPets(): Promise<Pet[]> {
  const { data } = await api.get<Pet[]>("/pets");
  return data;
}

export async function getPet(id: number): Promise<Pet> {
  const { data } = await api.get<Pet>(`/pets/${id}`);
  return data;
}

export async function createPet(input: CreatePetInput): Promise<Pet> {
  const { data } = await api.post<Pet>("/pets", input);
  return data;
}

export async function updatePet(id: number, input: UpdatePetInput): Promise<Pet> {
  const { data } = await api.put<Pet>(`/pets/${id}`, input);
  return data;
}

export async function deletePet(id: number): Promise<void> {
  await api.delete(`/pets/${id}`);
}
