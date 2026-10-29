import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PetForm from '@/components/pets/PetForm'
import * as authService from '@/services/auth.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { CreatePetInput } from '@/types/pet.types'

vi.mock('@/services/auth.service')

const FOTO_A = 'https://pub.r2.dev/pets/a.jpg'
const FOTO_B = 'https://pub.r2.dev/pets/b.jpg'

// el uploader real sube a R2: el doble expone un boton por callback
vi.mock('@/components/reports/ImageUploader', () => ({
  default: ({
    onSuccess,
    onError,
    onUploadingChange,
  }: {
    onSuccess: (url: string, rejection: string | null) => void
    onError: (error: string, code?: string) => void
    onUploadingChange?: (uploading: boolean) => void
  }) => (
    <>
      <button type='button' onClick={() => onSuccess('https://pub.r2.dev/pets/a.jpg', null)}>
        Simular foto A
      </button>
      <button type='button' onClick={() => onSuccess('https://pub.r2.dev/pets/b.jpg', null)}>
        Simular foto B
      </button>
      <button type='button' onClick={() => onUploadingChange?.(true)}>
        Simular subida en curso
      </button>
      <button type='button' onClick={() => onError('No se pudo subir la imagen')}>
        Simular falla de subida
      </button>
    </>
  ),
}))

const onSubmit = vi.fn<(input: CreatePetInput) => Promise<void>>()

function renderForm(initialValues?: Partial<CreatePetInput>) {
  const { Wrapper } = createQueryWrapper()
  render(
    <Wrapper>
      <PetForm initialValues={initialValues} submitLabel='Guardar mascota' onSubmit={onSubmit} />
    </Wrapper>
  )
}

async function completarObligatorios(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nombre *'), 'Firulais')
  await user.type(screen.getByLabelText('Raza *'), 'Labrador')
  await user.type(screen.getByLabelText('Edad (años) *'), '3')
  await user.type(screen.getByLabelText('Color *'), 'Marrón')
  await user.type(screen.getByLabelText('Descripción *'), 'Collar rojo')
}

const guardar = () => screen.getByRole('button', { name: 'Guardar mascota' })

beforeEach(() => {
  vi.clearAllMocks()
  onSubmit.mockResolvedValue(undefined)
})

describe('PetForm: validacion', () => {
  it('marca los campos obligatorios sin enviar', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(guardar())

    expect(await screen.findByText('Ingresá el nombre')).toBeInTheDocument()
    expect(screen.getByText('Ingresá la raza')).toBeInTheDocument()
    expect(screen.getByText('Ingresá la edad')).toBeInTheDocument()
    expect(screen.getByText('Ingresá el color')).toBeInTheDocument()
    expect(screen.getByText('Ingresá una descripción')).toBeInTheDocument()
    expect(screen.getByText('Subí al menos una foto')).toBeInTheDocument()
    expect(screen.getByText('Por favor, corregí los errores del formulario')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('exige al menos una foto aunque el resto este completo', async () => {
    const user = userEvent.setup()
    renderForm()

    await completarObligatorios(user)
    await user.click(guardar())

    expect(await screen.findByText('Subí al menos una foto')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rechaza una edad negativa', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Edad (años) *'), '-2')
    await user.click(guardar())

    expect(await screen.findByText('La edad no puede ser negativa')).toBeInTheDocument()
  })

  it('limpia el error del campo al corregirlo', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(guardar())
    await screen.findByText('Ingresá el nombre')
    await user.type(screen.getByLabelText('Nombre *'), 'F')

    expect(screen.queryByText('Ingresá el nombre')).not.toBeInTheDocument()
  })

  it('limpia el error de fotos al subir una', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(guardar())
    await screen.findByText('Subí al menos una foto')
    await user.click(screen.getByRole('button', { name: 'Simular foto A' }))

    expect(screen.queryByText('Subí al menos una foto')).not.toBeInTheDocument()
  })
})

describe('PetForm: fotos', () => {
  it('agrega varias fotos y quita la elegida', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Simular foto A' }))
    await user.click(screen.getByRole('button', { name: 'Simular foto B' }))

    expect(screen.getByRole('img', { name: 'Foto 1' })).toHaveAttribute('src', FOTO_A)
    expect(screen.getByRole('img', { name: 'Foto 2' })).toHaveAttribute('src', FOTO_B)

    await user.click(screen.getByRole('button', { name: 'Quitar foto 1' }))

    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'Foto 1' })).toHaveAttribute('src', FOTO_B)
  })

  it('quitar la unica foto vuelve a exigir una', async () => {
    const user = userEvent.setup()
    renderForm()

    await completarObligatorios(user)
    await user.click(screen.getByRole('button', { name: 'Simular foto A' }))
    await user.click(screen.getByRole('button', { name: 'Quitar foto 1' }))
    await user.click(guardar())

    expect(await screen.findByText('Subí al menos una foto')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('bloquea el envio mientras una foto se esta subiendo', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Simular subida en curso' }))

    expect(guardar()).toBeDisabled()
  })

  it('no repite el error de subida que ya muestra el uploader', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Simular falla de subida' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('PetForm: envio', () => {
  it('manda la edad como numero y omite los opcionales vacios', async () => {
    const user = userEvent.setup()
    renderForm()

    await completarObligatorios(user)
    await user.click(screen.getByRole('button', { name: 'Simular foto A' }))
    await user.click(screen.getByRole('button', { name: 'Simular foto B' }))
    await user.click(guardar())

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: 'Firulais',
      breed: 'Labrador',
      age: 3,
      color: 'Marrón',
      description: 'Collar rojo',
      photoUrls: [FOTO_A, FOTO_B],
    })
  })

  it('manda especie y microchip cuando se completan', async () => {
    const user = userEvent.setup()
    renderForm()

    await completarObligatorios(user)
    await user.selectOptions(screen.getByLabelText('Especie'), 'cat')
    await user.type(screen.getByLabelText('Microchip'), '985112003456789')
    await user.click(screen.getByRole('button', { name: 'Simular foto A' }))
    await user.click(guardar())

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ species: 'cat', microchipId: '985112003456789' })
      )
    )
  })

  it('precarga los valores iniciales', async () => {
    const user = userEvent.setup()
    renderForm({
      name: 'Rocky',
      species: 'dog',
      breed: 'Caniche',
      age: 4,
      color: 'Blanco',
      description: 'Mancha en la oreja',
      photoUrls: [FOTO_A],
    })

    expect(screen.getByLabelText('Nombre *')).toHaveValue('Rocky')
    expect(screen.getByLabelText('Especie')).toHaveValue('dog')
    expect(screen.getByLabelText('Edad (años) *')).toHaveValue(4)
    expect(screen.getByRole('img', { name: 'Foto 1' })).toHaveAttribute('src', FOTO_A)

    await user.click(guardar())

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ age: 4, photoUrls: [FOTO_A] })
      )
    )
  })

  it('muestra el error del backend y conserva lo cargado', async () => {
    onSubmit.mockRejectedValue(new Error('No tenés permiso para modificar esta mascota'))
    const user = userEvent.setup()
    renderForm()

    await completarObligatorios(user)
    await user.click(screen.getByRole('button', { name: 'Simular foto A' }))
    await user.click(guardar())

    expect(
      await screen.findByText('No tenés permiso para modificar esta mascota')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Firulais')
  })

  it('muestra el aviso de email sin verificar cuando el backend responde 403', async () => {
    onSubmit.mockRejectedValue(
      Object.assign(new Error('Verificá tu email'), { status: 403, code: 'EMAIL_NOT_VERIFIED' })
    )
    vi.mocked(authService.resendVerification).mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    renderForm()

    await completarObligatorios(user)
    await user.click(screen.getByRole('button', { name: 'Simular foto A' }))
    await user.click(guardar())

    expect(
      await screen.findByRole('button', { name: 'Reenviar email de verificación' })
    ).toBeInTheDocument()
  })

  it('cae a un mensaje generico si el rechazo no es un Error', async () => {
    onSubmit.mockRejectedValue('caida de red')
    const user = userEvent.setup()
    renderForm()

    await completarObligatorios(user)
    await user.click(screen.getByRole('button', { name: 'Simular foto A' }))
    await user.click(guardar())

    expect(await screen.findByText('No se pudo guardar la mascota')).toBeInTheDocument()
  })
})
