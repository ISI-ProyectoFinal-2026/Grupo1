import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { BoneTag } from '@/components/ui/canine'
import type { PetDTO } from '@/types/pet.types'

interface PetCardProps {
  pet: PetDTO
  onDelete: () => void
  isDeleting?: boolean
  deleteError?: string | null
}

// confirmación en línea, mismo patrón que CloseReportButton
export default function PetCard({
  pet,
  onDelete,
  isDeleting = false,
  deleteError = null,
}: PetCardProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const name = pet.name ?? 'Sin nombre'
  const photo = pet.photoUrls[0]

  return (
    <li className='card flex flex-col gap-3 p-4'>
      <div className='flex items-center gap-4'>
        {photo ? (
          <img
            src={photo}
            alt={name}
            className='size-20 shrink-0 rounded-control border border-line object-cover'
          />
        ) : (
          <span className='grid size-20 shrink-0 place-items-center rounded-control bg-surface'>
            <BoneTag className='w-14 -rotate-6' />
          </span>
        )}
        <div className='min-w-0'>
          <h2 className='truncate font-display text-display-sm'>{name}</h2>
          {pet.breed && <p className='text-ink-muted'>{pet.breed}</p>}
        </div>
      </div>

      {isConfirming ? (
        <div className='flex flex-col gap-3'>
          <p className='text-ink'>¿Seguro que querés eliminar a {name}? No se puede deshacer.</p>
          <div className='grid grid-cols-2 gap-2'>
            <Button variant='danger' isLoading={isDeleting} onClick={onDelete}>
              Confirmar eliminación
            </Button>
            <Button
              variant='secondary'
              disabled={isDeleting}
              onClick={() => setIsConfirming(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className='grid grid-cols-2 gap-2'>
          <Link
            to={`/pets/${pet.id}/edit`}
            aria-label={`Editar ${name}`}
            className={buttonClasses('secondary')}
          >
            Editar
          </Link>
          <Button
            variant='ghost'
            aria-label={`Eliminar ${name}`}
            onClick={() => setIsConfirming(true)}
          >
            Eliminar
          </Button>
        </div>
      )}
      {deleteError && <ErrorMessage message={deleteError} />}
    </li>
  )
}
