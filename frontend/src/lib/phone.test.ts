import { describe, expect, it } from 'vitest'
import { getPhoneError } from '@/lib/phone'

describe('getPhoneError', () => {
  it.each([
    '',
    '   ',
    '11 5555-5555',
    '+54 9 351 555-5555',
    '(0351) 555-5555',
    '12345678',
    '123456789012345',
  ])('acepta %j', (valor) => {
    expect(getPhoneError(valor)).toBeNull()
  })

  it.each(['11-5555-555a', '54+9351555555', '++5493515555555', '351.555.5555'])(
    'rechaza caracteres no permitidos en %j',
    (valor) => {
      expect(getPhoneError(valor)).toBe(
        'Usá solo números, espacios, guiones, paréntesis y un + al principio'
      )
    }
  )

  it.each(['1234567', '1234567890123456'])('rechaza la cantidad de digitos de %j', (valor) => {
    expect(getPhoneError(valor)).toBe('El teléfono debe tener entre 8 y 15 dígitos')
  })

  it('rechaza mas de 30 caracteres', () => {
    expect(getPhoneError('1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6')).toBe(
      'El teléfono puede tener hasta 30 caracteres'
    )
  })
})
