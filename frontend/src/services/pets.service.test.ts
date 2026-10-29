import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import { createPet, deletePet, getPet, listMyPets, updatePet } from '@/services/pets.service'
import type { CreatePetInput, PetDTO } from '@/types/pet.types'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

function mascota(overrides: Partial<PetDTO> = {}): PetDTO {
  return {
    id: 3,
    userId: 7,
    name: 'Firulais',
    species: 'dog',
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

const input: CreatePetInput = {
  name: 'Firulais',
  breed: 'Labrador',
  age: 3,
  color: 'Marrón',
  description: 'Collar rojo',
  photoUrls: ['https://pub.r2.dev/pets/foto1.jpg'],
}

describe('pets.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista las mascotas propias contra GET /pets', async () => {
    const listado = [mascota()]
    vi.mocked(api.get).mockResolvedValue(respuesta(listado))

    const resultado = await listMyPets()

    expect(api.get).toHaveBeenCalledWith('/pets')
    expect(resultado).toEqual(listado)
  })

  it('trae el detalle desde GET /pets/:id', async () => {
    vi.mocked(api.get).mockResolvedValue(respuesta(mascota({ id: 9 })))

    const resultado = await getPet(9)

    expect(api.get).toHaveBeenCalledWith('/pets/9')
    expect(resultado.id).toBe(9)
  })

  it('crea contra POST /pets', async () => {
    vi.mocked(api.post).mockResolvedValue(respuesta(mascota()))

    const resultado = await createPet(input)

    expect(api.post).toHaveBeenCalledWith('/pets', input)
    expect(resultado.id).toBe(3)
  })

  it('actualiza contra PUT /pets/:id', async () => {
    vi.mocked(api.put).mockResolvedValue(respuesta(mascota({ name: 'Rocky' })))

    const resultado = await updatePet(3, { name: 'Rocky' })

    expect(api.put).toHaveBeenCalledWith('/pets/3', { name: 'Rocky' })
    expect(resultado.name).toBe('Rocky')
  })

  it('elimina contra DELETE /pets/:id', async () => {
    vi.mocked(api.delete).mockResolvedValue(respuesta(undefined))

    await deletePet(3)

    expect(api.delete).toHaveBeenCalledWith('/pets/3')
  })
})
