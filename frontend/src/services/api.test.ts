import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Los interceptores son el unico lugar donde el frontend decide que hacer con
// un 401 y como se ve un error de la API. Para poder ejercitarlos sin red, se
// mockea axios.create y se guardan los callbacks que api.ts registra.
const capturado = vi.hoisted(() => ({
  request: [] as Array<(config: unknown) => unknown>,
  response: [] as Array<[unknown, (error: unknown) => Promise<never>]>,
}))

vi.mock('axios', () => ({
  default: {
    create: () => ({
      interceptors: {
        request: {
          use: (fn: (config: unknown) => unknown) => capturado.request.push(fn),
        },
        response: {
          use: (ok: unknown, err: (error: unknown) => Promise<never>) =>
            capturado.response.push([ok, err]),
        },
      },
    }),
  },
}))

const { getApiErrorDetails, getApiErrorStatus } = await import('@/services/api')
const { useAuthStore } = await import('@/stores/auth.store')

const aplicarRequest = capturado.request[0]
const alFallar = capturado.response[0][1]

function configFalso() {
  return { headers: { set: vi.fn() } }
}

function errorAxios(status: number, body?: unknown) {
  return { response: { status, data: body } }
}

const usuario = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

describe('interceptor de request', () => {
  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('agrega el header Authorization cuando hay token', () => {
    useAuthStore.getState().setAuth('jwt-de-prueba', usuario)
    const config = configFalso()

    aplicarRequest(config)

    expect(config.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer jwt-de-prueba')
  })

  it('no toca los headers cuando no hay sesion', () => {
    const config = configFalso()

    aplicarRequest(config)

    expect(config.headers.set).not.toHaveBeenCalled()
  })
})

describe('interceptor de response', () => {
  let locationFalsa: { pathname: string; href: string }

  beforeEach(() => {
    locationFalsa = { pathname: '/reports/5', href: '/reports/5' }
    Object.defineProperty(window, 'location', {
      value: locationFalsa,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    useAuthStore.getState().logout()
  })

  it('normaliza el mensaje que manda el backend', async () => {
    const error = errorAxios(404, { error: { message: 'Reporte no encontrado' } })

    await expect(alFallar(error)).rejects.toThrow('Reporte no encontrado')
  })

  it('cae a un mensaje generico si la respuesta no trae uno', async () => {
    await expect(alFallar(errorAxios(500))).rejects.toThrow(
      'Error inesperado, intentá de nuevo'
    )
  })

  it('conserva status y details para que el formulario los muestre', async () => {
    const details = [{ path: 'email', message: 'Ya esta registrado' }]
    const error = errorAxios(422, { error: { message: 'Datos invalidos', details } })

    const rechazado = await alFallar(error).catch((e: unknown) => e)

    expect(getApiErrorStatus(rechazado)).toBe(422)
    expect(getApiErrorDetails(rechazado)).toEqual(details)
  })

  it('cierra la sesion y manda al login ante un 401', async () => {
    useAuthStore.getState().setAuth('jwt-vencido', usuario)

    await alFallar(errorAxios(401, { error: { message: 'Token vencido' } })).catch(() => {})

    expect(useAuthStore.getState().token).toBeNull()
    expect(locationFalsa.href).toBe('/login')
  })

  // Sin este guard, un 401 del propio login dispara otra navegacion a /login y
  // el usuario pierde el mensaje de "credenciales invalidas" en pantalla.
  it('no redirige si el 401 vino del propio login', async () => {
    locationFalsa.pathname = '/login'

    await alFallar(errorAxios(401, { error: { message: 'Credenciales invalidas' } })).catch(
      () => {}
    )

    expect(locationFalsa.href).toBe('/reports/5')
  })
})

describe('lectores de error', () => {
  it('devuelve el status HTTP cuando el error lo tiene', () => {
    const error = Object.assign(new Error('Comercio no encontrado'), { status: 404 })
    expect(getApiErrorStatus(error)).toBe(404)
  })

  it('devuelve undefined si el error no tiene status', () => {
    expect(getApiErrorStatus(new Error('otro error'))).toBeUndefined()
    expect(getApiErrorStatus('no es un error')).toBeUndefined()
  })

  it('devuelve undefined si el error no trae details', () => {
    expect(getApiErrorDetails(new Error('otro error'))).toBeUndefined()
    expect(getApiErrorDetails(null)).toBeUndefined()
  })
})
