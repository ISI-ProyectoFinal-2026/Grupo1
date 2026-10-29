import { z } from 'zod'

const requiredText = (message: string) => z.string({ error: message }).trim().min(1, message)

// "" se omite: el backend declara estos campos min(1).optional()
const optionalText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
  })

export const createPetSchema = z.object({
  name: requiredText('Ingresá el nombre'),
  species: optionalText,
  breed: requiredText('Ingresá la raza'),
  age: z
    .number({ error: 'Ingresá la edad' })
    .int('La edad tiene que ser un número entero')
    .min(0, 'La edad no puede ser negativa'),
  color: requiredText('Ingresá el color'),
  description: requiredText('Ingresá una descripción'),
  photoUrls: z.array(z.string().url()).min(1, 'Subí al menos una foto'),
  microchipId: optionalText,
})

export type PetFormData = z.infer<typeof createPetSchema>
