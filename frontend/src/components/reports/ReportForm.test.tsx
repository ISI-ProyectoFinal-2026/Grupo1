import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportForm from '@/components/reports/ReportForm'
import { createReport } from '@/services/reports.service'
import type { ReportDTO } from '@/types/report.types'

vi.mock('@/services/reports.service', () => ({ createReport: vi.fn() }))

// LocationPicker y ImageUploader arrastran leaflet y el flujo de subida a R2:
// nada de eso hace falta para probar la validacion y el envio del formulario.
// Los dobles exponen un boton por callback para dispararlos desde el test.
vi.mock('@/components/reports/LocationPicker', () => ({
  default: ({
    onLocationSelect,
  }: {
    onLocationSelect: (loc: { lat: number; lng: number }, address: string) => void
  }) => (
    <button
      type='button'
      onClick={() => onLocationSelect({ lat: -31.42, lng: -64.18 }, 'Nueva Córdoba')}
    >
      Elegir ubicación
    </button>
  ),
}))

vi.mock('@/components/reports/ImageUploader', () => ({
  default: ({
    onSuccess,
    onError,
    onUploadingChange,
  }: {
    onSuccess: (url: string, rejection: string | null) => void
    onError: (error: string) => void
    onUploadingChange?: (uploading: boolean) => void
  }) => (
    <>
      <button type='button' onClick={() => onUploadingChange?.(true)}>
        Simular subida en curso
      </button>
      <button
        type='button'
        onClick={() => {
          onSuccess('https://cdn/foto.jpg', null)
          onUploadingChange?.(false)
        }}
      >
        Simular foto subida
      </button>
      <button type='button' onClick={() => onSuccess('https://cdn/paisaje.jpg', 'Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM')}>
        Simular foto sin animales
      </button>
      <button type='button' onClick={() => onSuccess('https://cdn/foto.jpg', null)}>
        Simular analisis no disponible
      </button>
      <button type='button' onClick={() => onError('No se pudo subir la imagen (HTTP 403)')}>
        Simular falla de subida
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
  render(
    <MemoryRouter initialEntries={['/reports/new']}>
      <Routes>
        <Route path='/reports/new' element={<ReportForm initialData={initialData} />} />
        <Route path='/reports/:id' element={<DetalleFalso />} />
      </Routes>
    </MemoryRouter>
  )
}

async function completarMinimo(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Título *'), 'Perro perdido en Nueva Córdoba')
  await user.click(screen.getByRole('button', { name: 'Elegir ubicación' }))
}

beforeEach(() => {
  vi.clearAllMocks()
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

    expect(screen.queryByText('✓ Foto subida correctamente')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Simular foto subida' }))

    expect(screen.getByText('✓ Foto subida correctamente')).toBeInTheDocument()
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

  it('explica como cargar la ubicacion cuando falta', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Título *'), 'Perro perdido en Nueva Córdoba')
    await user.click(screen.getByRole('button', { name: 'Crear Reporte' }))

    expect(
      await screen.findByText('Indicá la ubicación con el botón de arriba')
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
    expect(screen.queryByText('✓ Foto subida correctamente')).not.toBeInTheDocument()
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
