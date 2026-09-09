import { describe, expect, it } from 'vitest'
import { getApiErrorStatus } from '@/services/api'

describe('getApiErrorStatus', () => {
  it('devuelve el status HTTP cuando el error lo tiene', () => {
    const error = Object.assign(new Error('Comercio no encontrado'), { status: 404 })
    expect(getApiErrorStatus(error)).toBe(404)
  })

  it('devuelve undefined si el error no tiene status', () => {
    expect(getApiErrorStatus(new Error('otro error'))).toBeUndefined()
    expect(getApiErrorStatus('no es un error')).toBeUndefined()
  })
})
