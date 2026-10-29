import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as petsService from '@/services/pets.service'
import {
  useCreatePetMutation,
  useDeletePetMutation,
  useMyPetsQuery,
  usePetQuery,
  useUpdatePetMutation,
} from '@/hooks/usePets'
import type { PetDTO } from '@/types/pet.types'

vi.mock('@/services/pets.service')

function mascota(overrides: Partial<PetDTO> = {}): PetDTO {
  return {
    id: 3,
    userId: 7,
    name: 'Firulais',
    species: null,
    breed: 'Labrador',
    age: 3,
    color: 'Marrón',
    description: 'Collar rojo',
    photoUrls: ['https://pub.r2.dev/pets/foto1.jpg'],
    microchipId: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

const input = {
  name: 'Rocky',
  breed: 'Caniche',
  age: 2,
  color: 'Blanco',
  description: 'Mancha en la oreja',
  photoUrls: ['https://pub.r2.dev/pets/rocky.jpg'],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('consultas', () => {
  it('useMyPetsQuery trae las mascotas propias', async () => {
    vi.mocked(petsService.listMyPets).mockResolvedValue([mascota()])
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useMyPetsQuery(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([mascota()])
  })

  it('usePetQuery trae una mascota por id', async () => {
    vi.mocked(petsService.getPet).mockResolvedValue(mascota({ id: 9 }))
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => usePetQuery(9), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(petsService.getPet).toHaveBeenCalledWith(9)
  })

  it('usePetQuery no consulta sin id valido', () => {
    const { Wrapper } = createQueryWrapper()

    renderHook(() => usePetQuery(undefined), { wrapper: Wrapper })

    expect(petsService.getPet).not.toHaveBeenCalled()
  })
})

describe('mutaciones', () => {
  function conListado() {
    vi.mocked(petsService.listMyPets).mockResolvedValue([mascota()])
    const { Wrapper } = createQueryWrapper()
    return Wrapper
  }

  it('crear vuelve a pedir el listado', async () => {
    vi.mocked(petsService.createPet).mockResolvedValue(mascota({ id: 4 }))
    const Wrapper = conListado()
    const { result } = renderHook(
      () => ({ listado: useMyPetsQuery(), crear: useCreatePetMutation() }),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.listado.isSuccess).toBe(true))

    await result.current.crear.mutateAsync(input)

    expect(petsService.createPet).toHaveBeenCalledWith(input)
    await waitFor(() => expect(petsService.listMyPets).toHaveBeenCalledTimes(2))
  })

  it('actualizar manda id y cambios y vuelve a pedir el listado', async () => {
    vi.mocked(petsService.updatePet).mockResolvedValue(mascota({ name: 'Rocky' }))
    const Wrapper = conListado()
    const { result } = renderHook(
      () => ({ listado: useMyPetsQuery(), actualizar: useUpdatePetMutation() }),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.listado.isSuccess).toBe(true))

    await result.current.actualizar.mutateAsync({ id: 3, input: { name: 'Rocky' } })

    expect(petsService.updatePet).toHaveBeenCalledWith(3, { name: 'Rocky' })
    await waitFor(() => expect(petsService.listMyPets).toHaveBeenCalledTimes(2))
  })

  it('eliminar vuelve a pedir el listado', async () => {
    vi.mocked(petsService.deletePet).mockResolvedValue(undefined)
    const Wrapper = conListado()
    const { result } = renderHook(
      () => ({ listado: useMyPetsQuery(), eliminar: useDeletePetMutation() }),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.listado.isSuccess).toBe(true))

    await result.current.eliminar.mutateAsync(3)

    expect(petsService.deletePet).toHaveBeenCalledWith(3)
    await waitFor(() => expect(petsService.listMyPets).toHaveBeenCalledTimes(2))
  })
})
