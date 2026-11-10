import { describe, expect, it } from 'vitest'
import { petPrefill } from './petPrefill'
import type { PetDTO } from '@/types/pet.types'

function mascota(photoUrls: string[]): PetDTO {
  return {
    id: 3,
    userId: 7,
    name: 'Firulais',
    species: 'dog',
    breed: 'Labrador',
    age: 3,
    color: 'Marrón',
    description: 'Collar azul',
    photoUrls,
    microchipId: null,
    createdAt: '2026-10-01T10:00:00.000Z',
  }
}

const foto = (n: number) => `https://pub.r2.dev/pets/${n}.jpg`

describe('petPrefill: fotos', () => {
  it('usa la primera foto como principal y el resto como extra', () => {
    expect(petPrefill(mascota([foto(1), foto(2), foto(3)]))).toMatchObject({
      imageUrl: foto(1),
      extraImageUrls: [foto(2), foto(3)],
    })
  })

  it('copia como maximo 3 fotos extra', () => {
    expect(petPrefill(mascota([1, 2, 3, 4, 5].map(foto))).extraImageUrls).toEqual([foto(2), foto(3), foto(4)])
  })

  it('sin fotos no precarga ninguna', () => {
    expect(petPrefill(mascota([]))).toMatchObject({ imageUrl: undefined, extraImageUrls: [] })
  })
})
