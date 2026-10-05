import type { AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  analyzeImage,
  getPresignedUrl,
  uploadToR2,
} from '@/services/uploads.service'

vi.mock('@/services/api', () => ({
  api: { post: vi.fn() },
}))

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

describe('getPresignedUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // El backend valida el tamano antes de firmar: si fileSize deja de viajar en
  // el body, la respuesta es 400 y el upload nunca arranca.
  it('manda nombre, tipo y tamano a POST /uploads/presign', async () => {
    const firma = {
      uploadUrl: 'https://r2/upload?firma=abc',
      publicUrl: 'https://cdn/foto.jpg',
      key: 'reports/foto.jpg',
    }
    vi.mocked(api.post).mockResolvedValue(respuesta(firma))

    const resultado = await getPresignedUrl('foto.jpg', 'image/jpeg', 12345)

    expect(api.post).toHaveBeenCalledWith('/uploads/presign', {
      fileName: 'foto.jpg',
      contentType: 'image/jpeg',
      fileSize: 12345,
    })
    expect(resultado).toEqual(firma)
  })
})

describe('limites de subida', () => {
  // Estos valores tienen que seguir a backend/src/validators/uploads.validator.ts.
  // Si el frontend valida por debajo, rechaza fotos que el servidor aceptaba.
  it('mantiene el tope en 10 MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(10_000_000)
  })

  it('acepta solo jpeg, png y webp', () => {
    expect(ALLOWED_UPLOAD_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp'])
  })
})

describe('uploadToR2', () => {
  const fetchFalso = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchFalso)
    fetchFalso.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function archivo() {
    return new File(['contenido'], 'foto.jpg', { type: 'image/jpeg' })
  }

  it('sube el archivo con PUT y el Content-Type del archivo', async () => {
    fetchFalso.mockResolvedValue({ ok: true, status: 200 })
    const file = archivo()

    await uploadToR2('https://r2/upload?firma=abc', file)

    expect(fetchFalso).toHaveBeenCalledWith('https://r2/upload?firma=abc', {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': 'image/jpeg' },
    })
  })

  // fetch solo rechaza ante fallas de red: un 403 por firma vencida resuelve
  // como cualquier otra respuesta. Sin el chequeo de response.ok el reporte se
  // creaba apuntando a un objeto que nunca llego a R2.
  it('falla explicitamente cuando R2 responde con error', async () => {
    fetchFalso.mockResolvedValue({ ok: false, status: 403 })

    await expect(uploadToR2('https://r2/upload?vencida', archivo())).rejects.toThrow(
      'No se pudo subir la imagen (HTTP 403)'
    )
  })

  it('menciona que la URL vence a los 5 minutos para que el usuario reintente', async () => {
    fetchFalso.mockResolvedValue({ ok: false, status: 403 })

    await expect(uploadToR2('https://r2/upload?vencida', archivo())).rejects.toThrow(
      /vence a los 5 minutos/
    )
  })
})

describe('analyzeImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends the uploaded image URL to POST /uploads/analyze', async () => {
    vi.mocked(api.post).mockResolvedValue(respuesta({ hasAnimal: true }))

    await analyzeImage('https://cdn/perro.jpg')

    expect(api.post).toHaveBeenCalledWith('/uploads/analyze', { imageUrl: 'https://cdn/perro.jpg' })
  })

  it.each([true, null])('returns hasAnimal=%s as answered by the backend', async (hasAnimal) => {
    vi.mocked(api.post).mockResolvedValue(respuesta({ hasAnimal }))

    await expect(analyzeImage('https://cdn/foto.jpg')).resolves.toEqual({ hasAnimal })
  })

  it('returns the rejection message sent by the backend when no animal is detected', async () => {
    const rejection = { hasAnimal: false, message: 'Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM' }
    vi.mocked(api.post).mockResolvedValue(respuesta(rejection))

    await expect(analyzeImage('https://cdn/paisaje.jpg')).resolves.toEqual(rejection)
  })
})
