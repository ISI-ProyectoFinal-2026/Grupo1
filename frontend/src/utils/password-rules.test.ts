import { describe, expect, it } from 'vitest'
import { getPasswordErrors } from '@/utils/password-rules'

describe('getPasswordErrors', () => {
  it('no devuelve errores para una contraseña que cumple las cuatro reglas', () => {
    expect(getPasswordErrors('Secreta123')).toEqual([])
  })

  it.each([
    ['Abc123', 'mínimo 8 caracteres'],
    ['ABCDEFG1', 'al menos una minúscula'],
    ['abcdefg1', 'al menos una mayúscula'],
    ['Abcdefgh', 'al menos un número'],
  ])('"%s" incumple solo "%s"', (password, regla) => {
    expect(getPasswordErrors(password)).toEqual([regla])
  })

  it('acumula todas las reglas incumplidas', () => {
    expect(getPasswordErrors('abc')).toEqual([
      'mínimo 8 caracteres',
      'al menos una mayúscula',
      'al menos un número',
    ])
  })
})
