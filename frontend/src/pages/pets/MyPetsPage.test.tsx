import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyPetsPage from '@/pages/pets/MyPetsPage'
import * as petsService from '@/services/pets.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { PetDTO } from '@/types/pet.types'

vi.mock('@/services/pets.service')

function mascota(overrides: Partial<PetDTO> = {}): PetDTO {
  return {
    id: 3,
    userId: 7,
    name: 'Firulais',
    species: 'dog',
    breed: 'Labrador',
    age: 3,
    color: 'Marrón',
    description: 'Collar rojo',
    photoUrls: ['https://pub.r2.dev/pets/firulais.jpg'],
    microchipId: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

function renderPage(state?: { message: string }) {
  const { Wrapper } = createQueryWrapper()
  render(
    <Wrapper>
      <MemoryRouter initialEntries={[{ pathname: '/pets', state }]}>
        <Routes>
          <Route path='/pets' element={<MyPetsPage />} />
          <Route path='/pets/new' element={<div>pagina alta mascota</div>} />
          <Route path='/pets/:id/edit' element={<div>pagina editar mascota</div>} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MyPetsPage: listado', () => {
  it('muestra foto, nombre y raza de cada mascota propia', async () => {
    vi.mocked(petsService.listMyPets).mockResolvedValue([
      mascota(),
      mascota({
        id: 4,
        name: 'Michi',
        breed: 'Siamés',
        photoUrls: ['https://pub.r2.dev/pets/michi.jpg'],
      }),
    ])
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Firulais' })).toBeInTheDocument()
    expect(screen.getByText('Labrador')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Firulais' })).toHaveAttribute(
      'src',
      'https://pub.r2.dev/pets/firulais.jpg'
    )
    expect(screen.getByRole('heading', { name: 'Michi' })).toBeInTheDocument()
    expect(screen.getByText('Siamés')).toBeInTheDocument()
  })

  it('muestra un estado vacio con acceso al alta', async () => {
    vi.mocked(petsService.listMyPets).mockResolvedValue([])
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Todavía no cargaste ninguna mascota.')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Agregar mascota' }))

    expect(screen.getByText('pagina alta mascota')).toBeInTheDocument()
  })

  it('avisa si no pudo cargar el listado', async () => {
    vi.mocked(petsService.listMyPets).mockRejectedValue(new Error('Error del servidor'))
    renderPage()

    expect(await screen.findByText('No se pudieron cargar tus mascotas')).toBeInTheDocument()
  })

  it('muestra el aviso que deja el alta o la edicion', async () => {
    vi.mocked(petsService.listMyPets).mockResolvedValue([mascota()])
    renderPage({ message: 'Mascota agregada' })

    expect(await screen.findByRole('status')).toHaveTextContent('Mascota agregada')
  })

  it('el enlace de edicion lleva al formulario de la mascota', async () => {
    vi.mocked(petsService.listMyPets).mockResolvedValue([mascota()])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('link', { name: 'Editar Firulais' }))

    expect(screen.getByText('pagina editar mascota')).toBeInTheDocument()
  })

  it('una mascota sin nombre ni foto igual se lista', async () => {
    vi.mocked(petsService.listMyPets).mockResolvedValue([
      mascota({ name: null, breed: null, photoUrls: [] }),
    ])
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Sin nombre' })).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('MyPetsPage: eliminar', () => {
  it('pide confirmacion antes de eliminar', async () => {
    vi.mocked(petsService.listMyPets).mockResolvedValue([mascota()])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Eliminar Firulais' }))

    expect(
      screen.getByText('¿Seguro que querés eliminar a Firulais? No se puede deshacer.')
    ).toBeInTheDocument()
    expect(petsService.deletePet).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByText(/Seguro que querés eliminar/)).not.toBeInTheDocument()
    expect(petsService.deletePet).not.toHaveBeenCalled()
  })

  it('elimina al confirmar y refresca el listado', async () => {
    vi.mocked(petsService.listMyPets).mockResolvedValueOnce([mascota()]).mockResolvedValueOnce([])
    vi.mocked(petsService.deletePet).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Eliminar Firulais' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))

    await waitFor(() => expect(petsService.deletePet).toHaveBeenCalledWith(3))
    expect(await screen.findByText('Todavía no cargaste ninguna mascota.')).toBeInTheDocument()
  })

  it('muestra el error solo en la mascota que fallo', async () => {
    vi.mocked(petsService.listMyPets).mockResolvedValue([
      mascota(),
      mascota({ id: 4, name: 'Michi' }),
    ])
    vi.mocked(petsService.deletePet).mockRejectedValue(
      new Error('No tenés permiso para eliminar esta mascota')
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Eliminar Firulais' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))

    const tarjeta = screen.getByRole('heading', { name: 'Firulais' }).closest('li')!
    expect(
      await within(tarjeta).findByText('No tenés permiso para eliminar esta mascota')
    ).toBeInTheDocument()
    const otra = screen.getByRole('heading', { name: 'Michi' }).closest('li')!
    expect(within(otra).queryByRole('alert')).not.toBeInTheDocument()
  })
})
