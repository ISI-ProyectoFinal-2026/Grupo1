import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReportForm from '@/components/reports/ReportForm'
import { newReportSchema } from '@/types/validators/report.validator'
import { createReport, findSimilarReports } from '@/services/reports.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { ReportDTO } from '@/types/report.types'
import * as authService from '@/services/auth.service'
import { listMyPets } from '@/services/pets.service'
import { analyzeImage } from '@/services/uploads.service'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser } from '@/types/auth'
import type { PetDTO } from '@/types/pet.types'

vi.mock('@/services/reports.service', () => ({ createReport: vi.fn(), findSimilarReports: vi.fn() }))
vi.mock('@/services/auth.service')
vi.mock('@/services/pets.service')
vi.mock('@/services/uploads.service')

// LocationPicker y MultiImageUploader arrastran leaflet y el flujo de subida a R2:
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

vi.mock('@/components/common/MultiImageUploader', () => ({
  default: ({
    value,
    onChange,
    max,
    onUploadingChange,
  }: {
    value: string[]
    onChange: (urls: string[]) => void
    max: number
    onUploadingChange?: (uploading: boolean) => void
  }) => (
    <>
      <p>{`${value.length}/${max}`}</p>
      {value.map((url, index) => (
        <img key={url} src={url} alt={`Foto ${index + 1}`} />
      ))}
      <button type='button' onClick={() => onUploadingChange?.(true)}>
        Simular subida en curso
      </button>
      <button
        type='button'
        onClick={() => {
          onChange([...value, 'https://cdn/foto.jpg'].slice(0, max))
          onUploadingChange?.(false)
        }}
      >
        Simular foto subida
      </button>
      <button
        type='button'
        onClick={() => onChange([...value, 'https://cdn/extra-1.jpg', 'https://cdn/extra-2.jpg'].slice(0, max))}
      >
        Simular fotos extra
      </button>
      <button type='button' onClick={() => onChange([value[1], value[0], ...value.slice(2)])}>
        Simular cambio de principal
      </button>
      <button type='button' onClick={() => onChange(value.slice(1))}>
        Simular quitar principal
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
    extraImageUrls: [],
    customFlyerUrl: null,
    showPhoneOnFlyer: false,
    eventDate: null,
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
  vi.mocked(analyzeImage).mockResolvedValue({ hasAnimal: true, lowQuality: false })
})

describe('ReportForm: render', () => {
  it('arranca en "Mascota Perdida" por defecto', () => {
    renderForm()

    expect(screen.getByRole('combobox')).toHaveValue('lost')
  })

  it('el distintivo junto al tipo cambia de color segun la seleccion (#257)', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.getByText('Mascota Perdida', { selector: 'span' })).toHaveClass('bg-lost')
    await user.selectOptions(screen.getByLabelText('Tipo de reporte *'), 'found')

    expect(screen.getByText('Mascota Encontrada', { selector: 'span' })).toHaveClass('bg-found')
    expect(screen.queryByText('Mascota Perdida', { selector: 'span' })).not.toBeInTheDocument()
  })

  it('acepta datos iniciales para precargar el formulario', () => {
    renderForm({ reportType: 'found', title: 'Gato encontrado en Güemes' })

    expect(screen.getByRole('combobox')).toHaveValue('found')
    expect(screen.getByLabelText('Título *')).toHaveValue('Gato encontrado en Güemes')
  })

  it('ofrece hasta 4 fotos', () => {
    renderForm()

    expect(screen.getByText('0/4')).toBeInTheDocument()
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
  it('manda la principal y las fotos extra', async () => {
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Simular fotos extra' }))
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
    expect(vi.mocked(createReport).mock.calls[0][0]).toMatchObject({
      imageUrl: 'https://cdn/foto.jpg',
      extraImageUrls: ['https://cdn/extra-1.jpg', 'https://cdn/extra-2.jpg'],
    })
  })

  it('quitar la principal convierte la siguiente en principal', async () => {
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Simular fotos extra' }))
    await user.click(screen.getByRole('button', { name: 'Simular quitar principal' }))
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
    expect(vi.mocked(createReport).mock.calls[0][0]).toMatchObject({
      imageUrl: 'https://cdn/extra-1.jpg',
      extraImageUrls: ['https://cdn/extra-2.jpg'],
    })
  })

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

describe('ReportForm: precarga de la mascota propia (#255)', () => {
  const firulais = () =>
    mascota({
      description: 'Collar azul con chapita',
      photoUrls: ['https://pub.r2.dev/pets/a.jpg', 'https://pub.r2.dev/pets/b.jpg'],
    })

  async function elegirMascota(user: ReturnType<typeof userEvent.setup>, opcion: string) {
    await user.selectOptions(await screen.findByLabelText('Mascota'), opcion)
  }

  it('precarga titulo, descripcion y las fotos: solo falta la ubicacion', async () => {
    vi.mocked(listMyPets).mockResolvedValue([firulais()])
    vi.mocked(createReport).mockResolvedValue(reporte({ petId: 3 }))
    const user = userEvent.setup()
    renderForm()

    await elegirMascota(user, 'Firulais (Labrador)')

    expect(screen.getByLabelText('Título *')).toHaveValue('Firulais (Labrador)')
    expect(screen.getByLabelText('Descripción')).toHaveValue('Collar azul con chapita')
    expect(screen.getByAltText('Foto 1')).toHaveAttribute('src', 'https://pub.r2.dev/pets/a.jpg')
    expect(screen.getByAltText('Foto 2')).toHaveAttribute('src', 'https://pub.r2.dev/pets/b.jpg')
    expect(screen.getByText(/Usamos las fotos de tu mascota/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
    expect(vi.mocked(createReport).mock.calls[0][0]).toMatchObject({
      petId: 3,
      title: 'Firulais (Labrador)',
      description: 'Collar azul con chapita',
      imageUrl: 'https://pub.r2.dev/pets/a.jpg',
      extraImageUrls: ['https://pub.r2.dev/pets/b.jpg'],
    })
  })

  it('usa la especie cuando la mascota no tiene raza', async () => {
    vi.mocked(listMyPets).mockResolvedValue([mascota({ breed: null, species: 'cat', name: 'Michi' })])
    const user = userEvent.setup()
    renderForm()

    await elegirMascota(user, 'Michi')

    expect(screen.getByLabelText('Título *')).toHaveValue('Michi (Gato)')
  })

  it('los campos precargados se pueden editar antes de enviar', async () => {
    vi.mocked(listMyPets).mockResolvedValue([firulais()])
    vi.mocked(createReport).mockResolvedValue(reporte({ petId: 3 }))
    const user = userEvent.setup()
    renderForm()

    await elegirMascota(user, 'Firulais (Labrador)')
    const titulo = screen.getByLabelText('Título *')
    await user.clear(titulo)
    await user.type(titulo, 'Firulais perdido en Güemes')
    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))
    await user.click(screen.getByRole('button', { name: 'Simular quitar principal' }))
    await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
    expect(vi.mocked(createReport).mock.calls[0][0]).toMatchObject({
      title: 'Firulais perdido en Güemes',
      imageUrl: 'https://pub.r2.dev/pets/b.jpg',
      extraImageUrls: ['https://cdn/foto.jpg'],
    })
  })

  it('al volver a "Ninguna" limpia solo lo precargado que no se edito', async () => {
    vi.mocked(listMyPets).mockResolvedValue([firulais()])
    const user = userEvent.setup()
    renderForm()

    await elegirMascota(user, 'Firulais (Labrador)')
    await user.type(screen.getByLabelText('Título *'), ' perdido')
    await elegirMascota(user, 'Ninguna')

    expect(screen.getByLabelText('Título *')).toHaveValue('Firulais (Labrador) perdido')
    expect(screen.getByLabelText('Descripción')).toHaveValue('')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('no limpia la foto que el usuario subio en reemplazo', async () => {
    vi.mocked(listMyPets).mockResolvedValue([firulais()])
    const user = userEvent.setup()
    renderForm()

    await elegirMascota(user, 'Firulais (Labrador)')
    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))
    await elegirMascota(user, 'Ninguna')

    expect(screen.getByAltText('Foto 3')).toHaveAttribute('src', 'https://cdn/foto.jpg')
  })

  it('no pisa lo que el usuario ya habia escrito', async () => {
    vi.mocked(listMyPets).mockResolvedValue([firulais()])
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Título *'), 'Perro perdido en Güemes')
    await elegirMascota(user, 'Firulais (Labrador)')

    expect(screen.getByLabelText('Título *')).toHaveValue('Perro perdido en Güemes')
    expect(screen.getByLabelText('Descripción')).toHaveValue('Collar azul con chapita')
  })

  it('no precarga en un reporte de mascota encontrada', async () => {
    vi.mocked(listMyPets).mockResolvedValue([firulais()])
    const user = userEvent.setup()
    renderForm()

    await user.selectOptions(screen.getByLabelText('Tipo de reporte *'), 'found')
    await elegirMascota(user, 'Firulais (Labrador)')

    expect(screen.getByLabelText('Título *')).toHaveValue('')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('copia como maximo 4 fotos de la mascota', async () => {
    vi.mocked(listMyPets).mockResolvedValue([
      mascota({ photoUrls: [1, 2, 3, 4, 5].map((n) => `https://pub.r2.dev/pets/${n}.jpg`) }),
    ])
    const user = userEvent.setup()
    renderForm()

    await elegirMascota(user, 'Firulais (Labrador)')

    expect(screen.getByText('4/4')).toBeInTheDocument()
  })

  it('todas las fotos precargadas pasan por la verificacion', async () => {
    vi.mocked(listMyPets).mockResolvedValue([firulais()])
    const user = userEvent.setup()
    renderForm()

    await elegirMascota(user, 'Firulais (Labrador)')

    await waitFor(() => expect(analyzeImage).toHaveBeenCalledWith('https://pub.r2.dev/pets/b.jpg'))
    expect(analyzeImage).toHaveBeenCalledWith('https://pub.r2.dev/pets/a.jpg')
  })

  it('una foto precargada sin animales bloquea hasta quitarla', async () => {
    vi.mocked(listMyPets).mockResolvedValue([firulais()])
    vi.mocked(analyzeImage).mockImplementation(async (url: string) =>
      url.endsWith('a.jpg')
        ? { hasAnimal: false, lowQuality: false, message: 'Sin animales en la foto' }
        : { hasAnimal: true, lowQuality: false }
    )
    const user = userEvent.setup()
    renderForm()

    await elegirMascota(user, 'Firulais (Labrador)')
    expect(await screen.findByText('Sin animales en la foto')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear Reporte' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Simular quitar principal' }))

    expect(screen.queryByText('Sin animales en la foto')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear Reporte' })).toBeEnabled()
  })

  it('la foto precargada pasa por la misma verificacion que una subida', async () => {
    vi.mocked(listMyPets).mockResolvedValue([firulais()])
    vi.mocked(analyzeImage).mockResolvedValue({
      hasAnimal: false,
      lowQuality: false,
      message: 'Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM',
    })
    const user = userEvent.setup()
    renderForm()

    await elegirMascota(user, 'Firulais (Labrador)')

    expect(
      await screen.findByText(
        'Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM'
      )
    ).toBeInTheDocument()
    expect(analyzeImage).toHaveBeenCalledWith('https://pub.r2.dev/pets/a.jpg')
    expect(screen.getByRole('button', { name: 'Crear Reporte' })).toBeDisabled()
  })
})

describe('ReportForm: fecha del suceso (#259)', () => {
  // 2 de noviembre 17:00 en Argentina; el navegador en Tokio ya está en el 3
  const AHORA = new Date('2026-11-02T20:00:00Z')
  const hoy = () => '2026-11-02'

  beforeEach(() => {
    vi.stubEnv('TZ', 'Asia/Tokyo')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(AHORA)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('el dia local del navegador difiere del de Argentina en este escenario', () => {
    expect(new Date().getDate()).toBe(3)
  })

  it('arranca en hoy de Argentina, no permite fechas futuras y la manda al crear', async () => {
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    const fecha = screen.getByLabelText('Fecha del suceso *')
    expect(fecha).toHaveValue(hoy())
    expect(fecha).toHaveAttribute('max', hoy())
    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
    expect(vi.mocked(createReport).mock.calls[0][0].eventDate).toBe(hoy())
  })

  it('es obligatoria al crear', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.clear(screen.getByLabelText('Fecha del suceso *'))
    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(await screen.findByText('Indicá la fecha del suceso')).toBeInTheDocument()
    expect(createReport).not.toHaveBeenCalled()
  })

  it('no envia una fecha futura', async () => {
    const user = userEvent.setup()
    renderForm({ eventDate: '2999-01-01' })

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(screen.getByLabelText('Fecha del suceso *')).toBeInvalid()
    expect(createReport).not.toHaveBeenCalled()
  })

  it('rechaza el dia siguiente de Argentina aunque ya sea hoy en el navegador', () => {
    const result = newReportSchema.safeParse({
      reportType: 'lost',
      title: 'Perro perdido en Güemes',
      imageUrl: 'https://cdn/foto.jpg',
      location: { lat: -31.42, lng: -64.18 },
      eventDate: '2026-11-03',
    })

    expect(result.success).toBe(false)
  })

  it('el esquema rechaza una fecha futura con su mensaje', () => {
    const result = newReportSchema.safeParse({
      reportType: 'lost',
      title: 'Perro perdido en Güemes',
      imageUrl: 'https://cdn/foto.jpg',
      location: { lat: -31.42, lng: -64.18 },
      eventDate: '2999-01-01',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('La fecha del suceso no puede ser futura')
  })
})

describe('ReportForm: telefono en el flyer (#259)', () => {
  function usuario(phone: string | null): AuthUser {
    return {
      id: 7,
      email: 'usuario7@patitas.test',
      fullName: null,
      phone,
      role: 'usuario_regular',
      emailVerifiedAt: '2026-09-01T10:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
  }

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('sin telefono en el perfil no ofrece mostrarlo', () => {
    useAuthStore.setState({ token: 'token', user: usuario(null) })
    renderForm()

    expect(screen.queryByLabelText(/Mostrar mi teléfono en el flyer/)).not.toBeInTheDocument()
  })

  it('con telefono lo ofrece desmarcado y no lo manda si no se marca', async () => {
    useAuthStore.setState({ token: 'token', user: usuario('11 5555-5555') })
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    expect(screen.getByLabelText(/Mostrar mi teléfono en el flyer/)).not.toBeChecked()
    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
    expect(vi.mocked(createReport).mock.calls[0][0].showPhoneOnFlyer).toBeFalsy()
  })

  it('manda el consentimiento cuando se marca', async () => {
    useAuthStore.setState({ token: 'token', user: usuario('11 5555-5555') })
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByLabelText(/Mostrar mi teléfono en el flyer/))
    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
    expect(vi.mocked(createReport).mock.calls[0][0].showPhoneOnFlyer).toBe(true)
  })

  it('precarga el consentimiento guardado', () => {
    useAuthStore.setState({ token: 'token', user: usuario('11 5555-5555') })
    renderForm({ showPhoneOnFlyer: true })

    expect(screen.getByLabelText(/Mostrar mi teléfono en el flyer/)).toBeChecked()
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

  it('allows creating the report when the analysis is unavailable', async () => {
    vi.mocked(createReport).mockResolvedValue(reporte())
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)

    expect(screen.queryByText(NO_ANIMAL_MESSAGE)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    await waitFor(() => expect(createReport).toHaveBeenCalled())
  })

  it('shows the backend 422 SPAM message when the server rejects the report', async () => {
    vi.mocked(createReport).mockRejectedValue(new Error(NO_ANIMAL_MESSAGE))
    const user = userEvent.setup()
    renderForm()

    await completarMinimo(user)
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(NO_ANIMAL_MESSAGE)
    expect(screen.queryByText('Detalle del reporte')).not.toBeInTheDocument()
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
      initialData?: Partial<typeof datosIniciales> & { extraImageUrls?: string[] }
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
      expect(onSubmit).toHaveBeenCalledWith({
        ...datosIniciales,
        extraImageUrls: [],
        title: 'Perro encontrado en Güemes',
      })
    )
    expect(createReport).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Crear Reporte' })).not.toBeInTheDocument()
  })

  it('muestra la foto actual y avisa que cambiarla vuelve a revision', () => {
    renderEdicion()

    expect(screen.getByAltText('Foto 1')).toHaveAttribute('src', 'https://cdn/actual.jpg')
    expect(screen.getByText(/Si cambiás las fotos, el reporte vuelve a revisión/)).toBeInTheDocument()
  })

  it('guarda la foto nueva cuando el usuario reemplaza la principal', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEdicion()

    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))
    await user.click(screen.getByRole('button', { name: 'Simular quitar principal' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl: 'https://cdn/foto.jpg', extraImageUrls: [] })
      )
    )
  })

  it('precarga las fotos extra y guarda los cambios sobre ellas', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEdicion({
      initialData: { ...datosIniciales, extraImageUrls: ['https://cdn/extra-0.jpg'] },
    })

    expect(screen.getByAltText('Foto 2')).toHaveAttribute('src', 'https://cdn/extra-0.jpg')
    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: 'https://cdn/actual.jpg',
          extraImageUrls: ['https://cdn/extra-0.jpg', 'https://cdn/foto.jpg'],
        })
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
    expect(screen.getByText(/Las fotos de un reporte resuelto no se pueden cambiar/)).toBeInTheDocument()
    expect(screen.getByAltText('Foto 1')).toHaveAttribute('src', 'https://cdn/actual.jpg')
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

  it('busca con la foto principal aunque haya fotos extra', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))
    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))
    await user.click(screen.getByRole('button', { name: 'Simular fotos extra' }))
    await user.click(screen.getByRole('button', { name: 'Simular cambio de principal' }))

    await waitFor(() =>
      expect(findSimilarReports).toHaveBeenLastCalledWith(
        expect.objectContaining({ imageUrl: 'https://cdn/extra-1.jpg' })
      )
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
