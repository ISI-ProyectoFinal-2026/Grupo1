import { Link, useLocation } from 'react-router-dom'
import PetCard from '@/components/pets/PetCard'
import { buttonClasses } from '@/components/ui/buttonClasses'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { PlusIcon } from '@/components/ui/icons'
import EmptyState from '@/components/ui/EmptyState'
import { Skeleton, SkeletonGroup } from '@/components/ui/Skeleton'
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
        <p role='status' className='mt-4 animate-drop font-bold text-success-ink'>
          {message}
        </p>
      )}

      <div className='mt-6'>
        {petsQuery.isLoading ? (
          <SkeletonGroup className='flex animate-fade flex-col gap-4'>
            {[0, 1, 2].map((key) => (
              <div key={key} className='card flex flex-col gap-3 p-4'>
                <div className='flex items-center gap-4'>
                  <Skeleton className='size-20 shrink-0 rounded-control' />
                  <div className='flex flex-1 flex-col gap-2'>
                    <Skeleton className='h-5 w-1/2' />
                    <Skeleton className='h-4 w-1/3' />
                  </div>
                </div>
                <div className='grid grid-cols-2 gap-2'>
                  <Skeleton className='h-11 rounded-control' />
                  <Skeleton className='h-11 rounded-control' />
                </div>
              </div>
            ))}
          </SkeletonGroup>
        ) : petsQuery.isError ? (
          <ErrorMessage message='No se pudieron cargar tus mascotas' />
        ) : petsQuery.data?.length === 0 ? (
          <EmptyState>
            <p className='text-ink-muted'>Todavía no cargaste ninguna mascota.</p>
          </EmptyState>
        ) : (
          <ul className='stagger flex flex-col gap-4'>
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
