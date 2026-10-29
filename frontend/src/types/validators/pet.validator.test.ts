import { describe, expect, it } from 'vitest'
import { createPetSchema } from '@/types/validators/pet.validator'

function mascotaValida(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Firulais',
    breed: 'Labrador',
    age: 3,
    color: 'Marrón',
    description: 'Collar rojo',
    photoUrls: ['https://pub.r2.dev/pets/foto1.jpg'],
    ...overrides,
  }
}

function mensajeDe(input: Record<string, unknown>, campo: string) {
  const resultado = createPetSchema.safeParse(input)
  return resultado.error?.issues.find((issue) => issue.path[0] === campo)?.message
}

describe('createPetSchema', () => {
  it('acepta los campos obligatorios', () => {
    expect(createPetSchema.safeParse(mascotaValida()).success).toBe(true)
  })

  it.each([
    ['name', 'Ingresá el nombre'],
    ['breed', 'Ingresá la raza'],
    ['color', 'Ingresá el color'],
    ['description', 'Ingresá una descripción'],
  ])('exige %s con un mensaje propio', (campo, mensaje) => {
    expect(mensajeDe(mascotaValida({ [campo]: '   ' }), campo)).toBe(mensaje)
  })

  it('exige la edad', () => {
    expect(mensajeDe(mascotaValida({ age: undefined }), 'age')).toBe('Ingresá la edad')
    expect(mensajeDe(mascotaValida({ age: Number.NaN }), 'age')).toBe('Ingresá la edad')
  })

  it('rechaza una edad negativa o con decimales', () => {
    expect(mensajeDe(mascotaValida({ age: -1 }), 'age')).toBe('La edad no puede ser negativa')
    expect(mensajeDe(mascotaValida({ age: 1.5 }), 'age')).toBe(
      'La edad tiene que ser un número entero'
    )
  })

  it('acepta edad 0 (cachorro de menos de un año)', () => {
    expect(createPetSchema.safeParse(mascotaValida({ age: 0 })).success).toBe(true)
  })

  it('exige al menos una foto', () => {
    expect(mensajeDe(mascotaValida({ photoUrls: [] }), 'photoUrls')).toBe('Subí al menos una foto')
  })

  it('recorta los textos', () => {
    const resultado = createPetSchema.parse(mascotaValida({ name: '  Firulais  ' }))

    expect(resultado.name).toBe('Firulais')
  })

  // El backend declara especie y microchip como min(1).optional(): "" daria 400.
  it('omite especie y microchip cuando vienen vacios', () => {
    const resultado = createPetSchema.parse(mascotaValida({ species: '', microchipId: '  ' }))

    expect(resultado.species).toBeUndefined()
    expect(resultado.microchipId).toBeUndefined()
  })

  it('conserva especie y microchip cuando se completan', () => {
    const resultado = createPetSchema.parse(
      mascotaValida({ species: 'dog', microchipId: '985112003456789' })
    )

    expect(resultado.species).toBe('dog')
    expect(resultado.microchipId).toBe('985112003456789')
  })
})
