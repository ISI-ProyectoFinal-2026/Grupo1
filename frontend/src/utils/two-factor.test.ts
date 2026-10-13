import { describe, expect, it } from 'vitest'
import {
  formatResetDate,
  formatWaitMessage,
  getRetryAfterSeconds,
  normalizeSecondFactorCode,
} from '@/utils/two-factor'

describe('normalizeSecondFactorCode', () => {
  it('en modo TOTP saca todos los espacios, tambien los del medio', () => {
    expect(normalizeSecondFactorCode('totp', ' 123 456 ')).toBe('123456')
  })

  it('en modo TOTP no toca un codigo ya limpio', () => {
    expect(normalizeSecondFactorCode('totp', '000123')).toBe('000123')
  })

  it('en modo recuperacion conserva el guion y solo recorta los bordes', () => {
    expect(normalizeSecondFactorCode('recovery', '  ABCDE-FGHIJ ')).toBe('ABCDE-FGHIJ')
  })

  it('en modo recuperacion no cambia mayusculas ni minusculas: eso lo normaliza el backend', () => {
    expect(normalizeSecondFactorCode('recovery', 'abcde-fghij')).toBe('abcde-fghij')
  })
})

describe('getRetryAfterSeconds', () => {
  it('lee retryAfterSeconds de los details del error', () => {
    const error = Object.assign(new Error('Demasiados intentos'), {
      details: { retryAfterSeconds: 900 },
    })

    expect(getRetryAfterSeconds(error)).toBe(900)
  })

  it('devuelve undefined si details no trae el campo', () => {
    const error = Object.assign(new Error('x'), { details: [{ path: 'code', message: 'mal' }] })

    expect(getRetryAfterSeconds(error)).toBeUndefined()
  })

  it('devuelve undefined si el valor no es un numero positivo', () => {
    const texto = Object.assign(new Error('x'), { details: { retryAfterSeconds: '900' } })
    const cero = Object.assign(new Error('x'), { details: { retryAfterSeconds: 0 } })

    expect(getRetryAfterSeconds(texto)).toBeUndefined()
    expect(getRetryAfterSeconds(cero)).toBeUndefined()
  })

  it('devuelve undefined si el error no es un Error o no trae details', () => {
    expect(getRetryAfterSeconds(new Error('x'))).toBeUndefined()
    expect(getRetryAfterSeconds('caida de red')).toBeUndefined()
  })
})

describe('formatWaitMessage', () => {
  it('redondea hacia arriba a minutos', () => {
    expect(formatWaitMessage(900)).toBe('Probá de nuevo en 15 minutos')
    expect(formatWaitMessage(901)).toBe('Probá de nuevo en 16 minutos')
  })

  it('usa singular para un minuto o menos', () => {
    expect(formatWaitMessage(60)).toBe('Probá de nuevo en 1 minuto')
    expect(formatWaitMessage(25)).toBe('Probá de nuevo en 1 minuto')
  })
})

describe('formatResetDate', () => {
  // Mediodía UTC: en cualquier huso horario sigue siendo octubre de 2026.
  it('muestra la fecha en español con hora', () => {
    const texto = formatResetDate('2026-10-20T12:00:00.000Z')

    expect(texto).toMatch(/octubre de 2026/)
    expect(texto).toMatch(/\d{1,2}:\d{2}/)
  })

  it('cambia con la fecha recibida', () => {
    expect(formatResetDate('2026-12-15T12:00:00.000Z')).toMatch(/diciembre de 2026/)
  })
})
