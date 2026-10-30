import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportForm from '@/components/reports/ReportForm'
import { createReport, findSimilarReports } from '@/services/reports.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { ReportDTO } from '@/types/report.types'
import * as authService from '@/services/auth.service'
import { listMyPets } from '@/services/pets.service'
import type { PetDTO } from '@/types/pet.types'

vi.mock('@/services/reports.service', () => ({ createReport: vi.fn(), findSimilarReports: vi.fn() }))
vi.mock('@/services/auth.service')
vi.mock('@/services/pets.service')

// LocationPicker y ImageUploader arrastran leaflet y el flujo de subida a R2:
// nada de eso hace falta para probar la validacion y el envio del formulario.
// Los dobles exponen un boton por callback para dispararlos desde el test.
vi.mock('@/components/maps/LocationPicker', () => ({
  default: ({
    onLocationSelect,
    initialLocation,
    initialAddress,
  }: {
    onLocationSelect: (loc: { lat: number; lng: number }, address: string) => void
    initialLocation?: { lat: number; lng: number }
    initialAddress?: string
  }) => (
    <>
      <button
        type='button'
        onClick={() => onLocationSelect({ lat: -31.42, lng: -64.18 }, 'Nueva Córdoba')}
      >
        Elegir ubicación
      </button>
      {initialLocation && (
        <p>
          Ubicación inicial: {initialLocation.lat},{initialLocation.lng} {initialAddress}
        </p>
      )}
    </>
  ),
}))

vi.mock('@/components/reports/ImageUploader', () => ({
  default: ({
    onSuccess,
    onError,
    onUploadingChange,
  }: {
    onSuccess: (url: string, rejection: string | null, qualityWarning: string | null) => void
    onError: (error: string, code?: string) => void
    onUploadingChange?: (uploading: boolean) => void
  }) => (
    <>
      <button type='button' onClick={() => onUploadingChange?.(true)}>
        Simular subida en curso
      </button>
      <button
        type='button'
        onClick={() => {
          onSuccess('https://cdn/foto.jpg', null, null)
          onUploadingChange?.(false)
        }}
      >
        Simular foto subida
      </button>
      <button type='button' onClick={() => onSuccess('https://cdn/paisaje.jpg', 'Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM', null)}>
        Simular foto sin animales
      </button>
      <button
        type='button'
        onClick={() => onSuccess('https://cdn/borrosa.jpg', null, 'La foto parece borrosa o movida. Probá subir una foto más nítida para que sea más fácil reconocer a tu mascota.')}
      >
        Simular foto borrosa
      </button>
      <button type='button' onClick={() => onSuccess('https://cdn/foto.jpg', null, null)}>
        Simular analisis no disponible
      </button>
      <button type='button' onClick={() => onError('No se pudo subir la imagen (HTTP 403)')}>
        Simular falla de subida
      </button>
      <button
        type='button'
        onClick={() => onError('Verificá tu email para continuar', 'EMAIL_NOT_VERIFIED')}
      >
        Simular falla por email sin verificar
      </button>
    </>
  ),
}))

function reporte(overrides: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: 12,
    userId: 7,
    petId: null,
    reportType: 'lost',
    status: 'pending',
    title: 'Perro perdido en Nueva Córdoba',
    description: null,
    imageUrl: 'https://cdn/foto.jpg',
    customFlyerUrl: null,
    locationAddress: 'Nueva Córdoba',
    location: { lat: -31.42, lng: -64.18 },
    tag: { label: 'Perdido', color: '#ef4444' },
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
    publishedAt: null,
    ...overrides,
  }
}

// Deja ver el state con el que ReportForm navega al detalle.
function DetalleFalso() {
  const location = useLocation()
  const state = location.state as { message?: string } | null
  return (
    <div>
      <p>Detalle del reporte</p>
      <p>{state?.message}</p>
    </div>
  )
}

function renderForm(initialData?: Parameters<typeof ReportForm>[0]['initialData']) {
  const { Wrapper } = createQueryWrapper()
  render(
    <Wrapper>
      <MemoryRouter initialEntries={['/reports/new']}>
        <Routes>
          <Route path='/reports/new' element={<ReportForm initialData={initialData} />} />
          <Route path='/reports/:id' element={<DetalleFalso />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

// La foto es obligatoria: el minimo para enviar incluye titulo, ubicacion y foto.
async function completarMinimo(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Título *'), 'Perro perdido en Nueva Córdoba')
  await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))
  await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))
}

function mascota(overrides: Partial<PetDTO> = {}): PetDTO {
  return {
    id: 3,
    userId: 7,
    name: 'Firulais',
    species: 'dog',
    breed: 'Labrador',
    age: 3,
    color: 'Marrón',
    description: null,
    photoUrls: ['https://pub.r2.dev/pets/a.jpg'],
    microchipId: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listMyPets).mockResolvedValue([])
  vi.mocked(findSimilarReports).mockResolvedValue([])
})

describe('ReportForm: render', () => {
  it('arranca en "Mascota Perdida" por defecto', () => {
    renderForm()

    expect(screen.getByRole('combobox')).toHaveValue('lost')
  })

  it('acepta datos iniciales para precargar el formulario', () => {
    renderForm({ reportType: 'found', title: 'Gato encontrado en Güemes' })

    expect(screen.getByRole('combobox')).toHaveValue('found')
    expect(screen.getByLabelText('Título *')).toHaveValue('Gato encontrado en Güemes')
  })

  it('confirma en pantalla cuando la foto ya subio', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.queryByText('Foto subida correctamente')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))

    expect(screen.getByText('Foto subida correctamente')).toBeInTheDocument()
  })

  it('muestra una miniatura de la foto subida', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.queryByRole('img', { name: 'Foto subida' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))

    expect(screen.getByRole('img', { name: 'Foto subida' })).toHaveAttribute(
      'src',
      'https://cdn/foto.jpg'
    )
  })

  it('muestra el error que reporta el uploader', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Simular falla de subida' }))

    expect(screen.getByText('No se pudo subir la imagen (HTTP 403)')).toBeInTheDocument()
  })
})

describe('ReportForm: validacion', () => {
  // Zod 4 expone las incidencias en `issues`; `errors` era la propiedad de v3 y
  // hoy es undefined. Si ese branch se rompe, el usuario ve el JSON crudo del
  // ZodError en vez de un mensaje por campo.
  it('marca el titulo corto sin llamar a la API', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Título *'), 'Perr')
    await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(await screen.findByText('Mínimo 5 caracteres')).toBeInTheDocument()
    expect(screen.getByText('Por favor, corregí los errores del formulario')).toBeInTheDocument()
    expect(createReport).not.toHaveBeenCalled()
  })

  it('pide la foto junto al campo y no llama a la API cuando falta', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Título *'), 'Perro perdido en Nueva Córdoba')
    await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(await screen.findByText('Sube una foto de la mascota')).toBeInTheDocument()
    expect(createReport).not.toHaveBeenCalled()
  })

  it('explica como cargar la ubicacion cuando falta', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Título *'), 'Perro perdido en Nueva Córdoba')
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(
      await screen.findByText('Marcá la ubicación en el mapa o usá tu ubicación actual')
    ).toBeInTheDocument()
    expect(createReport).not.toHaveBeenCalled()
  })

  it('limpia el error del campo al corregirlo', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Título *'), 'Perr')
    await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))
    await screen.findByText('Mínimo 5 caracteres')

    await user.type(screen.getByLabelText('Título *'), 'o perdido')

    expect(screen.queryByText('Mínimo 5 caracteres')).not.toBeInTheDocument()
  })
})

describe('ReportForm: envio', () => {
  it('crea el reporte y navega al detalle con el aviso de exito', async () => {
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() =>
      expect(createReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportType: 'lost',
          title: 'Perro perdido en Nueva Córdoba',
          imageUrl: 'https://cdn/foto.jpg',
          location: { lat: -31.42, lng: -64.18 },
          locationAddress: 'Nueva Córdoba',
        })
      )
    )
    expect(await screen.findByText('Detalle del reporte')).toBeInTheDocument()
    expect(screen.getByText('Reporte creado exitosamente')).toBeInTheDocument()
  })

  // Una descripcion vacia no puede viajar como "": el backend la declara
  // min(1).optional() y responde 400.
  it('no manda los textos opcionales vacios', async () => {
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
    const enviado = vi.mocked(createReport).mock.calls[0][0]
    expect(enviado.description).toBeUndefined()
  })

  it('manda la descripcion cuando el usuario la completa', async () => {
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.type(screen.getByLabelText('Descripción'), 'Collar rojo')
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() =>
      expect(createReport).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Collar rojo' })
      )
    )
  })

  it('permite reportar una mascota encontrada', async () => {
    vi.mocked(createReport).mockResolvedValue(reporte({ reportType: 'found' }))
    const user = userEvent.setup()
    renderForm()

    await user.selectOptions(screen.getByRole('combobox'), 'found')
    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() =>
      expect(createReport).toHaveBeenCalledWith(expect.objectContaining({ reportType: 'found' }))
    )
  })

  it('muestra el mensaje del backend cuando el alta falla', async () => {
    vi.mocked(createReport).mockRejectedValue(new Error('No se pudo crear el reporte'))
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(await screen.findByText('No se pudo crear el reporte')).toBeInTheDocument()
    expect(screen.queryByText('Detalle del reporte')).not.toBeInTheDocument()
  })

  it('cae a un mensaje generico si el rechazo no es un Error', async () => {
    vi.mocked(createReport).mockRejectedValue('caida de red')
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(await screen.findByText('Error al crear el reporte')).toBeInTheDocument()
  })
})

describe('ReportForm: mascota vinculada (#225)', () => {
  it('ofrece elegir una de mis mascotas, sin ninguna elegida por defecto', async () => {
    vi.mocked(listMyPets).mockResolvedValue([
      mascota(),
      mascota({ id: 4, name: 'Michi', breed: null }),
    ])
    renderForm()

    const selector = await screen.findByLabelText('Mascota')
    expect(selector).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Ninguna' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Firulais (Labrador)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Michi' })).toBeInTheDocument()
  })

  it('manda el petId de la mascota elegida', async () => {
    vi.mocked(listMyPets).mockResolvedValue([mascota()])
    vi.mocked(createReport).mockResolvedValue(reporte({ petId: 3 }))
    const user = userEvent.setup()
    renderForm()

    await user.selectOptions(await screen.findByLabelText('Mascota'), 'Firulais (Labrador)')
    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
    expect(vi.mocked(createReport).mock.calls[0][0].petId).toBe(3)
  })

  it('no manda petId si se vuelve a "Ninguna"', async () => {
    vi.mocked(listMyPets).mockResolvedValue([mascota()])
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    const selector = await screen.findByLabelText('Mascota')
    await user.selectOptions(selector, 'Firulais (Labrador)')
    await user.selectOptions(selector, 'Ninguna')
    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
    expect(vi.mocked(createReport).mock.calls[0][0].petId).toBeUndefined()
  })

  it('no muestra el selector si no tengo mascotas', async () => {
    renderForm()

    await waitFor(() => expect(listMyPets).toHaveBeenCalled())
    expect(screen.queryByLabelText('Mascota')).not.toBeInTheDocument()
  })

  it('permite crear el reporte aunque falle la carga de mascotas', async () => {
    vi.mocked(listMyPets).mockRejectedValue(new Error('Error del servidor'))
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
    expect(screen.queryByLabelText('Mascota')).not.toBeInTheDocument()
    expect(vi.mocked(createReport).mock.calls[0][0].petId).toBeUndefined()
  })
})

describe('ReportForm: animal screening of the uploaded photo', () => {
  const NO_ANIMAL_MESSAGE =
    'Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM'

  it('allows creating the report when the photo shows an animal', async () => {
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))

    expect(screen.queryByText(NO_ANIMAL_MESSAGE)).not.toBeInTheDocument()
    const submit = screen.getByRole('button', { name: 'Crear Reporte' })
    expect(submit).toBeEnabled()

    await user.click(submit)

    await waitFor(() =>
      expect(createReport).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: 'https://cdn/foto.jpg' })
      )
    )
  })

  it('warns about SPAM and blocks submission when no animal is detected', async () => {
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Simular foto sin animales' }))

    expect(screen.getByRole('alert')).toHaveTextContent(NO_ANIMAL_MESSAGE)
    expect(screen.queryByText('Foto subida correctamente')).not.toBeInTheDocument()
    const submit = screen.getByRole('button', { name: 'Crear Reporte' })
    expect(submit).toBeDisabled()

    await user.click(submit)

    expect(createReport).not.toHaveBeenCalled()
  })

  it('unblocks submission once a photo with an animal replaces the rejected one', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Simular foto sin animales' }))
    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))

    expect(screen.queryByText(NO_ANIMAL_MESSAGE)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear Reporte' })).toBeEnabled()
  })

  it('allows creating the report when the analysis is unavailable', async () => {
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Simular analisis no disponible' }))

    expect(screen.queryByText(NO_ANIMAL_MESSAGE)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
  })

  it('shows the backend 422 SPAM message when the server rejects the report', async () => {
    vi.mocked(createReport).mockRejectedValue(new Error(NO_ANIMAL_MESSAGE))
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Simular analisis no disponible' }))
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(NO_ANIMAL_MESSAGE)
    expect(screen.queryByText('Detalle del reporte')).not.toBeInTheDocument()
  })
})

// #212: a blurry or moved photo only gets a warning, the report can still be published.
describe('ReportForm: low quality photo warning', () => {
  const QUALITY_MESSAGE =
    'La foto parece borrosa o movida. Probá subir una foto más nítida para que sea más fácil reconocer a tu mascota.'

  it('shows a non-blocking warning and still creates the report with that photo', async () => {
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Simular foto borrosa' }))

    expect(screen.getByText(QUALITY_MESSAGE).closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Foto subida' })).toHaveAttribute('src', 'https://cdn/borrosa.jpg')
    const submit = screen.getByRole('button', { name: 'Crear Reporte' })
    expect(submit).toBeEnabled()

    await user.click(submit)

    await waitFor(() =>
      expect(createReport).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: 'https://cdn/borrosa.jpg' })
      )
    )
  })

  it('clears the warning once a sharper photo replaces the blurry one', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Simular foto borrosa' }))
    expect(screen.getByText(QUALITY_MESSAGE)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))

    expect(screen.queryByText(QUALITY_MESSAGE)).not.toBeInTheDocument()
  })

  it('shows the rejection instead of the warning when the new photo has no animal', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Simular foto borrosa' }))
    await user.click(screen.getByRole('button', { name: 'Simular foto sin animales' }))

    expect(screen.queryByText(QUALITY_MESSAGE)).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

// The submit used to stay enabled while the photo was uploading/being analyzed:
// sending then created a report without image, published with no screening at all.
describe('ReportForm: submission while the photo is uploading', () => {
  it('disables the submit until the upload and its analysis finish', async () => {
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Simular subida en curso' }))

    const submit = screen.getByRole('button', { name: 'Crear Reporte' })
    expect(submit).toBeDisabled()
    await user.click(submit)
    expect(createReport).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))

    expect(submit).toBeEnabled()
    await user.click(submit)
    await waitFor(() =>
      expect(createReport).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: 'https://cdn/foto.jpg' })
      )
    )
  })
})

describe('ReportForm: email sin verificar (403 EMAIL_NOT_VERIFIED)', () => {
  const sinVerificar = () =>
    Object.assign(new Error('Verificá tu email para continuar'), {
      status: 403,
      code: 'EMAIL_NOT_VERIFIED',
    })

  // El boton queda habilitado a proposito y el 403 no borra nada: el usuario
  // verifica, vuelve y reenvia sin retipear el reporte.
  it('muestra el aviso con reenvio, conserva lo cargado y deja el boton habilitado', async () => {
    vi.mocked(createReport).mockRejectedValue(sinVerificar())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Verificá tu email para poder hacer esto'
    )
    expect(screen.getByRole('button', { name: 'Reenviar email de verificación' })).toBeEnabled()
    expect(screen.queryByText('Verificá tu email para continuar')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Título *')).toHaveValue('Perro perdido en Nueva Córdoba')
    expect(screen.getByRole('button', { name: 'Crear Reporte' })).toBeEnabled()
  })

  it('el reenvio del aviso pide otro email', async () => {
    vi.mocked(createReport).mockRejectedValue(sinVerificar())
    vi.mocked(authService.resendVerification).mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))
    await user.click(await screen.findByRole('button', { name: 'Reenviar email de verificación' }))

    expect(await screen.findByText('Te mandamos un nuevo email')).toBeInTheDocument()
    expect(authService.resendVerification).toHaveBeenCalledTimes(1)
  })

  it('reintentar tras verificar crea el reporte y el aviso desaparece', async () => {
    vi.mocked(createReport).mockRejectedValueOnce(sinVerificar()).mockResolvedValueOnce(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(await screen.findByText('Detalle del reporte')).toBeInTheDocument()
    expect(createReport).toHaveBeenCalledTimes(2)
  })

  // El uploader ya muestra su propio aviso: el formulario no puede repetirlo.
  it('si la subida de la foto da 403 muestra un solo aviso', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Simular falla por email sin verificar' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('un error comun sigue mostrandose como texto sin aviso de verificacion', async () => {
    vi.mocked(createReport).mockRejectedValue(new Error('Reporte duplicado'))
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(await screen.findByText('Reporte duplicado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reenviar email de verificación' })).toBeNull()
  })
})

describe('ReportForm: modo edicion', () => {
  const datosIniciales = {
    reportType: 'lost' as const,
    title: 'Perro perdido en Nueva Córdoba',
    description: 'Collar rojo',
    imageUrl: 'https://cdn/actual.jpg',
    location: { lat: -31.42, lng: -64.18 },
    locationAddress: 'Nueva Córdoba',
  }

  function renderEdicion(
    props: {
      onSubmit?: (data: unknown) => Promise<void>
      canChangeImage?: boolean
      initialData?: Partial<typeof datosIniciales>
    } = {}
  ) {
    const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined)
    const { Wrapper } = createQueryWrapper()
    render(
      <Wrapper>
        <MemoryRouter>
          <ReportForm
            mode='edit'
            initialData={props.initialData ?? datosIniciales}
            onSubmit={onSubmit}
            canChangeImage={props.canChangeImage}
          />
        </MemoryRouter>
      </Wrapper>
    )
    return { onSubmit }
  }

  it('precarga los datos y guarda con onSubmit sin crear otro reporte', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEdicion()

    expect(screen.getByLabelText('Título *')).toHaveValue('Perro perdido en Nueva Córdoba')
    expect(screen.getByLabelText('Descripción')).toHaveValue('Collar rojo')
    await user.clear(screen.getByLabelText('Título *'))
    await user.type(screen.getByLabelText('Título *'), 'Perro encontrado en Güemes')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ ...datosIniciales, title: 'Perro encontrado en Güemes' })
    )
    expect(createReport).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Crear Reporte' })).not.toBeInTheDocument()
  })

  it('muestra la foto actual y avisa que cambiarla vuelve a revision', () => {
    renderEdicion()

    expect(screen.getByAltText('Foto actual')).toHaveAttribute('src', 'https://cdn/actual.jpg')
    expect(screen.queryByText(/Foto subida correctamente/)).not.toBeInTheDocument()
    expect(screen.getByText(/Si cambiás la foto, el reporte vuelve a revisión/)).toBeInTheDocument()
  })

  it('confirma la foto nueva cuando el usuario la reemplaza', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEdicion()

    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))
    expect(screen.getByText(/Foto subida correctamente/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: 'https://cdn/foto.jpg' })
      )
    )
  })

  it('arranca el picker en la ubicacion guardada', () => {
    renderEdicion()

    expect(screen.getByText('Ubicación inicial: -31.42,-64.18 Nueva Córdoba')).toBeInTheDocument()
  })

  // el reporte editado ya existe: se sugeriria a si mismo como duplicado
  it('no sugiere reportes similares', async () => {
    vi.mocked(findSimilarReports).mockResolvedValue([
      {
        id: 21,
        title: 'Perro marrón visto en el parque',
        reportType: 'lost',
        status: 'published',
        imageUrl: null,
        distanceMeters: 300,
        similarity: null,
        isOwn: true,
      },
    ])
    const user = userEvent.setup()
    const { onSubmit } = renderEdicion()

    await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))
    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(findSimilarReports).not.toHaveBeenCalled()
    expect(screen.queryByText('¿Alguno de estos coincide con tu avistamiento?')).not.toBeInTheDocument()
  })

  // la foto es obligatoria tambien al editar (#239)
  it('no guarda un reporte sin foto hasta que se suba una', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEdicion({
      initialData: { ...datosIniciales, imageUrl: undefined },
    })

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Sube una foto de la mascota')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: 'https://cdn/foto.jpg' })
      )
    )
  })

  it('no ofrece cambiar la foto cuando el reporte no lo permite', () => {
    renderEdicion({ canChangeImage: false })

    expect(screen.queryByRole('button', { name: 'Simular foto subida' })).not.toBeInTheDocument()
    expect(screen.getByText(/La foto de un reporte resuelto no se puede cambiar/)).toBeInTheDocument()
  })

  it('muestra el error que devuelve el guardado', async () => {
    const user = userEvent.setup()
    renderEdicion({
      onSubmit: vi.fn().mockRejectedValue(new Error('No tenés permiso para modificar este reporte')),
    })

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('No tenés permiso para modificar este reporte')).toBeInTheDocument()
  })

  it('cae a un mensaje generico de edicion si el rechazo no es un Error', async () => {
    const user = userEvent.setup()
    renderEdicion({ onSubmit: vi.fn().mockRejectedValue('boom') })

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('Error al guardar los cambios')).toBeInTheDocument()
  })
})

describe('ReportForm: reportes similares (#211)', () => {
  const QUESTION = '¿Alguno de estos coincide con tu avistamiento?'
  const similar = {
    id: 21,
    title: 'Perro marrón visto en el parque',
    reportType: 'lost' as const,
    status: 'published' as const,
    imageUrl: null,
    distanceMeters: 300,
    similarity: null,
    isOwn: false,
  }

  it('sugiere reportes del mismo tipo apenas se marca la ubicacion', async () => {
    vi.mocked(findSimilarReports).mockResolvedValue([similar])
    const user = userEvent.setup()
    renderForm()

    expect(findSimilarReports).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))

    expect(await screen.findByText(QUESTION)).toBeInTheDocument()
    expect(screen.getByText('Perro marrón visto en el parque')).toBeInTheDocument()
    expect(findSimilarReports).toHaveBeenCalledWith({
      reportType: 'lost',
      location: { lat: -31.42, lng: -64.18 },
    })
  })

  it('vuelve a buscar con la foto cuando se sube despues del pin', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))
    await waitFor(() => expect(findSimilarReports).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))

    await waitFor(() =>
      expect(findSimilarReports).toHaveBeenLastCalledWith({
        reportType: 'lost',
        location: { lat: -31.42, lng: -64.18 },
        imageUrl: 'https://cdn/foto.jpg',
      })
    )
  })

  it('no usa una foto rechazada por no tener animales', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Simular foto sin animales' }))
    await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))

    await waitFor(() => expect(findSimilarReports).toHaveBeenCalled())
    expect(findSimilarReports).not.toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: expect.anything() })
    )
  })

  it('busca del tipo elegido', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.selectOptions(screen.getByRole('combobox'), 'found')
    await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))

    await waitFor(() =>
      expect(findSimilarReports).toHaveBeenCalledWith(expect.objectContaining({ reportType: 'found' }))
    )
  })

  it('"Sí, es este" abre el reporte existente sin crear el nuevo', async () => {
    vi.mocked(findSimilarReports).mockResolvedValue([similar])
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(await screen.findByRole('button', { name: /Sí, es este/ }))

    expect(await screen.findByText('Detalle del reporte')).toBeInTheDocument()
    expect(createReport).not.toHaveBeenCalled()
  })

  it('el formulario se envia igual si la busqueda de similares falla', async () => {
    vi.mocked(findSimilarReports).mockRejectedValue(new Error('caida'))
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await waitFor(() => expect(findSimilarReports).toHaveBeenCalled())
    expect(screen.queryByText(QUESTION)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(await screen.findByText('Reporte creado exitosamente')).toBeInTheDocument()
  })

  it('el formulario se envia aunque haya sugerencias sin elegir', async () => {
    vi.mocked(findSimilarReports).mockResolvedValue([similar])
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await screen.findByText(QUESTION)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(await screen.findByText('Reporte creado exitosamente')).toBeInTheDocument()
  })
})
