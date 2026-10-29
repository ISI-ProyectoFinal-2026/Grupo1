import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CreatePetPage from '@/pages/pets/CreatePetPage'
import * as petsService from '@/services/pets.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { CreatePetInput, PetDTO } from '@/types/pet.types'

vi.mock('@/services/pets.service')

const input: CreatePetInput = {
  name: 'Firulais',
  breed: 'Labrador',
  age: 3,
  color: 'Marrón',
  description: 'Collar rojo',
  photoUrls: ['https://pub.r2.dev/pets/a.jpg'],
}

// el formulario tiene sus propios tests: aca solo importa que hace la pagina con onSubmit
vi.mock('@/components/pets/PetForm', () => ({
  default: ({
    submitLabel,
    onSubmit,
  }: {
    submitLabel: string
    onSubmit: (value: CreatePetInput) => Promise<void>
  }) => (
    <button type='button' onClick={() => onSubmit(input).catch(() => undefined)}>
      {submitLabel}
    </button>
  ),
}))

function ListadoFalso() {
  const state = useLocation().state as { message?: string } | null
  return <p>listado: {state?.message}</p>
}

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  render(
    <Wrapper>
      <MemoryRouter initialEntries={['/pets/new']}>
        <Routes>
          <Route path='/pets/new' element={<CreatePetPage />} />
          <Route path='/pets' element={<ListadoFalso />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>
  )
}

describe('CreatePetPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('crea la mascota y vuelve al listado con aviso', async () => {
    vi.mocked(petsService.createPet).mockResolvedValue({ ...input, id: 3 } as PetDTO)
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('heading', { name: 'Agregar mascota' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Agregar mascota' }))

    await waitFor(() => expect(petsService.createPet).toHaveBeenCalledWith(input))
    expect(await screen.findByText('listado: Mascota agregada')).toBeInTheDocument()
  })

  it('se queda en el formulario si el alta falla', async () => {
    vi.mocked(petsService.createPet).mockRejectedValue(new Error('Error del servidor'))
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Agregar mascota' }))

    await waitFor(() => expect(petsService.createPet).toHaveBeenCalled())
    expect(screen.queryByText(/listado:/)).not.toBeInTheDocument()
  })
})
