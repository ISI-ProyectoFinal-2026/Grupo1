import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPet, deletePet, getPet, listMyPets, updatePet } from '@/services/pets.service'
import type { CreatePetInput, UpdatePetInput } from '@/types/pet.types'

const petsQueryKey = ['pets'] as const
const myPetsQueryKey = [...petsQueryKey, 'me'] as const

export function useMyPetsQuery() {
  return useQuery({ queryKey: myPetsQueryKey, queryFn: listMyPets })
}

export function usePetQuery(id: number | undefined) {
  return useQuery({
    queryKey: [...petsQueryKey, id],
    queryFn: () => getPet(id!),
    enabled: id !== undefined,
  })
}

// invalida listado y detalle (comparten el prefijo ['pets'])
function useInvalidatePets() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: petsQueryKey })
}

export function useCreatePetMutation() {
  const invalidate = useInvalidatePets()
  return useMutation({
    mutationFn: (input: CreatePetInput) => createPet(input),
    onSuccess: invalidate,
  })
}

export function useUpdatePetMutation() {
  const invalidate = useInvalidatePets()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdatePetInput }) => updatePet(id, input),
    onSuccess: invalidate,
  })
}

export function useDeletePetMutation() {
  const invalidate = useInvalidatePets()
  return useMutation({
    mutationFn: (id: number) => deletePet(id),
    onSuccess: invalidate,
  })
}
