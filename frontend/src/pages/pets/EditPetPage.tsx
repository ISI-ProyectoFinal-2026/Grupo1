import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PetForm from '@/components/pets/PetForm'
import ErrorMessage from '@/components/ui/ErrorMessage'
import Spinner from '@/components/ui/Spinner'
import { usePetQuery, useUpdatePetMutation } from '@/hooks/usePets'
import { getApiErrorStatus } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'
import type { CreatePetInput, PetDTO } from '@/types/pet.types'

// null del backend -> campo ausente en el formulario
function toInitialValues(pet: PetDTO): Partial<CreatePetInput> {
  return {
    name: pet.name ?? undefined,
    species: pet.species ?? undefined,
    breed: pet.breed ?? undefined,
    age: pet.age ?? undefined,
    color: pet.color ?? undefined,
    description: pet.description ?? undefined,
    photoUrls: pet.photoUrls,
    microchipId: pet.microchipId ?? undefined,
  }
}

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className='mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8'>
      <h1 className='font-display text-display-lg'>Editar mascota</h1>
      <div className='mt-6'>{children}</div>
    </div>
  )
}

function BackLink() {
  return (
    <Link to='/pets' className='mt-4 inline-block font-bold text-ink underline'>
      Volver a mis mascotas
    </Link>
  )
}

function NotOwnedMessage() {
  return (
    <Layout>
      <ErrorMessage message='No podés editar esta mascota porque no es tuya.' />
      <BackLink />
    </Layout>
  )
}

export default function EditPetPage() {
  const navigate = useNavigate()
  const params = useParams()
  const parsedId = Number(params.id)
  const id = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : undefined
  const userId = useAuthStore((state) => state.user?.id)
  const petQuery = usePetQuery(id)
  const updatePet = useUpdatePetMutation()

  if (id === undefined || getApiErrorStatus(petQuery.error) === 404) {
    return (
      <Layout>
        <ErrorMessage message='No encontramos esta mascota.' />
        <BackLink />
      </Layout>
    )
  }

  if (getApiErrorStatus(petQuery.error) === 403) {
    return <NotOwnedMessage />
  }

  if (petQuery.isLoading) {
    return (
      <div className='flex justify-center py-16 text-ink-muted'>
        <Spinner />
      </div>
    )
  }

  if (petQuery.isError || !petQuery.data) {
    return (
      <Layout>
        <ErrorMessage message='No se pudo cargar la mascota' />
        <BackLink />
      </Layout>
    )
  }

  const pet = petQuery.data
  if (pet.userId !== userId) {
    return <NotOwnedMessage />
  }

  const handleSubmit = async (input: CreatePetInput) => {
    await updatePet.mutateAsync({ id: pet.id, input })
    navigate('/pets', { state: { message: 'Cambios guardados' } })
  }

  return (
    <Layout>
      <div className='sm:card sm:p-6'>
        <PetForm
          initialValues={toInitialValues(pet)}
          submitLabel='Guardar cambios'
          onSubmit={handleSubmit}
        />
      </div>
    </Layout>
  )
}
