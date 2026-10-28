import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditPetPage from '@/pages/pets/EditPetPage'
import * as petsService from '@/services/pets.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { AuthUser } from '@/types/auth'
import type { CreatePetInput, PetDTO } from '@/types/pet.types'

vi.mock('@/services/pets.service')

const cambios: CreatePetInput = {
  name: 'Rocky',
  breed: 'Labrador',
  age: 4,
  color: 'Marrón',
  description: 'Collar rojo',
  photoUrls: ['https://pub.r2.dev/pets/a.jpg'],
}

vi.mock('@/components/pets/PetForm', () => ({
  default: ({
    initialValues,
    submitLabel,
    onSubmit,
  }: {
    initialValues?: Partial<CreatePetInput>
    submitLabel: string
    onSubmit: (value: CreatePetInput) => Promise<void>
  }) => (
    <>
      <pre data-testid='valores-iniciales'>{JSON.stringify(initialValues)}</pre>
      <button type='button' onClick={() => onSubmit(cambios).catch(() => undefined)}>
        {submitLabel}
      </button>
    </>
  ),
}))

const usuario: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: null,
  phone: null,
  role: 'usuario_regular',
  emailVerifiedAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}

function mascota(overrides: Partial<PetDTO> = {}): PetDTO {
  return {
    id: 3,
    userId: 7,
    name: 'Firulais',
    species: null,
    breed: 'Labrador',
    age: 3,
    color: 'Marrón',
    description: 'Collar rojo',
    photoUrls: ['https://pub.r2.dev/pets/a.jpg'],
    microchipId: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

function ListadoFalso() {
  const state = useLocation().state as { message?: string } | null
  return <p>listado: {state?.message}</p>
}

function renderPage(ruta = '/pets/3/edit') {
  const { Wrapper } = createQueryWrapper()
  render(
    <Wrapper>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path='/pets/:id/edit' element={<EditPetPage />} />
          <Route path='/pets' element={<ListadoFalso />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ token: 'token', user: usuario })
})

afterEach(() => {
  useAuthStore.setState({ token: null, user: null })
})

describe('EditPetPage', () => {
  it('precarga la mascota propia sin los campos nulos', async () => {
    vi.mocked(petsService.getPet).mockResolvedValue(mascota())
    renderPage()

    const valores = JSON.parse((await screen.findByTestId('valores-iniciales')).textContent!)

    expect(petsService.getPet).toHaveBeenCalledWith(3)
    expect(valores).toEqual({
      name: 'Firulais',
      breed: 'Labrador',
      age: 3,
      color: 'Marrón',
      description: 'Collar rojo',
      photoUrls: ['https://pub.r2.dev/pets/a.jpg'],
    })
  })

  it('guarda los cambios y vuelve al listado con aviso', async () => {
    vi.mocked(petsService.getPet).mockResolvedValue(mascota())
    vi.mocked(petsService.updatePet).mockResolvedValue(mascota({ name: 'Rocky' }))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(petsService.updatePet).toHaveBeenCalledWith(3, cambios))
    expect(await screen.findByText('listado: Cambios guardados')).toBeInTheDocument()
  })

  it('no deja editar una mascota ajena', async () => {
    vi.mocked(petsService.getPet).mockResolvedValue(mascota({ userId: 99 }))
    renderPage()

    expect(
      await screen.findByText('No podés editar esta mascota porque no es tuya.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a mis mascotas' })).toHaveAttribute(
      'href',
      '/pets'
    )
  })

  it('avisa si la mascota no existe', async () => {
    vi.mocked(petsService.getPet).mockRejectedValue(
      Object.assign(new Error('Mascota no encontrada'), { status: 404 })
    )
    renderPage()

    expect(await screen.findByText('No encontramos esta mascota.')).toBeInTheDocument()
  })

  it('no consulta con un id invalido', async () => {
    renderPage('/pets/abc/edit')

    expect(await screen.findByText('No encontramos esta mascota.')).toBeInTheDocument()
    expect(petsService.getPet).not.toHaveBeenCalled()
  })

  it('avisa si falla la carga por otro motivo', async () => {
    vi.mocked(petsService.getPet).mockRejectedValue(
      Object.assign(new Error('Error del servidor'), { status: 500 })
    )
    renderPage()

    expect(await screen.findByText('No se pudo cargar la mascota')).toBeInTheDocument()
  })
})
