import { Link, useLocation } from 'react-router-dom'
import PetCard from '@/components/pets/PetCard'
import { buttonClasses } from '@/components/ui/buttonClasses'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { PlusIcon } from '@/components/ui/icons'
import Spinner from '@/components/ui/Spinner'
import { useDeletePetMutation, useMyPetsQuery } from '@/hooks/usePets'

export default function MyPetsPage() {
  const message = (useLocation().state as { message?: string } | null)?.message
  const petsQuery = useMyPetsQuery()
  const deletePet = useDeletePetMutation()

  const deleteErrorFor = (id: number) =>
    deletePet.isError && deletePet.variables === id ? deletePet.error.message : null

  return (
    <div className='mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='font-display text-display-lg'>Mis mascotas</h1>
        <Link to='/pets/new' className={buttonClasses('signal')}>
          <PlusIcon className='h-5 w-5' />
          Agregar mascota
        </Link>
      </div>

      {message && (
        <p role='status' className='mt-4 font-bold text-success-ink'>
          {message}
        </p>
      )}

      <div className='mt-6'>
        {petsQuery.isLoading ? (
          <div className='flex justify-center py-16 text-ink-muted'>
            <Spinner />
          </div>
        ) : petsQuery.isError ? (
          <ErrorMessage message='No se pudieron cargar tus mascotas' />
        ) : petsQuery.data?.length === 0 ? (
          <p className='text-ink-muted'>Todavía no cargaste ninguna mascota.</p>
        ) : (
          <ul className='flex flex-col gap-4'>
            {petsQuery.data?.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                onDelete={() => deletePet.mutate(pet.id)}
                isDeleting={deletePet.isPending && deletePet.variables === pet.id}
                deleteError={deleteErrorFor(pet.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
