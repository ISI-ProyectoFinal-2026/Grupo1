import { describe, expect, it } from 'vitest'
import {
  createReportSchema,
  imageUploadSchema,
  reportLocationSchema,
} from '@/types/validators/report.validator'

function formularioValido(overrides: Record<string, unknown> = {}) {
  return {
    reportType: 'lost',
    title: 'Perro perdido en Nueva Cordoba',
    location: { lat: -31.42, lng: -64.18 },
    ...overrides,
  }
}

describe('createReportSchema', () => {
  it('acepta el minimo: tipo, titulo y ubicacion', () => {
    const resultado = createReportSchema.safeParse(formularioValido())

    expect(resultado.success).toBe(true)
  })

  it('exige al menos 5 caracteres en el titulo', () => {
    const resultado = createReportSchema.safeParse(formularioValido({ title: 'Perr' }))

    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0].message).toBe('Mínimo 5 caracteres')
  })

  // El mensaje por defecto de Zod para una clave ausente ("expected object,
  // received undefined") no le dice nada al usuario del formulario.
  it('explica como cargar la ubicacion cuando falta', () => {
    const { location: _location, ...sinUbicacion } = formularioValido()

    const resultado = createReportSchema.safeParse(sinUbicacion)

    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0].message).toBe('Indicá la ubicación con el botón de arriba')
  })

  // Los campos de texto opcionales arrancan como "" en el estado del form.
  // Enviarlos asi rebotaba con 400: el backend los declara min(1).optional(),
  // y una cadena vacia no es "ausente", es invalida.
  it('convierte los textos opcionales vacios en undefined', () => {
    const resultado = createReportSchema.safeParse(
      formularioValido({ description: '   ', locationAddress: '' })
    )

    expect(resultado.success).toBe(true)
    expect(resultado.data?.description).toBeUndefined()
    expect(resultado.data?.locationAddress).toBeUndefined()
  })

  it('recorta los espacios de los textos opcionales con contenido', () => {
    const resultado = createReportSchema.safeParse(
      formularioValido({ description: '  Collar rojo  ' })
    )

    expect(resultado.data?.description).toBe('Collar rojo')
  })

  it('rechaza un tipo de reporte que no sea lost o found', () => {
    const resultado = createReportSchema.safeParse(formularioValido({ reportType: 'robado' }))

    expect(resultado.success).toBe(false)
  })

  it('rechaza una imageUrl que no sea una URL', () => {
    const resultado = createReportSchema.safeParse(formularioValido({ imageUrl: 'foto.jpg' }))

    expect(resultado.success).toBe(false)
  })
})

describe('reportLocationSchema', () => {
  it('acepta coordenadas dentro de rango', () => {
    expect(reportLocationSchema.safeParse({ lat: -31.42, lng: -64.18 }).success).toBe(true)
  })

  it.each([
    ['latitud fuera de rango', { lat: 91, lng: 0 }],
    ['longitud fuera de rango', { lat: 0, lng: 181 }],
  ])('rechaza %s', (_caso, coordenadas) => {
    expect(reportLocationSchema.safeParse(coordenadas).success).toBe(false)
  })
})

describe('imageUploadSchema', () => {
  it('acepta los tres formatos habilitados', () => {
    for (const contentType of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(imageUploadSchema.safeParse({ fileName: 'foto', contentType }).success).toBe(true)
    }
  })

  it('rechaza un formato no soportado', () => {
    expect(
      imageUploadSchema.safeParse({ fileName: 'animacion', contentType: 'image/gif' }).success
    ).toBe(false)
  })
})
