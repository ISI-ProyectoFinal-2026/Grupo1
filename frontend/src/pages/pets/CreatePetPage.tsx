import { useNavigate } from 'react-router-dom'
import PetForm from '@/components/pets/PetForm'
import { useCreatePetMutation } from '@/hooks/usePets'
import type { CreatePetInput } from '@/types/pet.types'

export default function CreatePetPage() {
  const navigate = useNavigate()
  const createPet = useCreatePetMutation()

  const handleSubmit = async (input: CreatePetInput) => {
    await createPet.mutateAsync(input)
    navigate('/pets', { state: { message: 'Mascota agregada' } })
  }

  return (
    <div className='mx-auto max-w-2xl px-4 py-5 sm:px-6 lg:py-8'>
      <h1 className='font-display text-display-lg'>Agregar mascota</h1>
      <div className='mt-6 sm:card sm:p-6'>
        <PetForm submitLabel='Agregar mascota' onSubmit={handleSubmit} />
      </div>
    </div>
  )
}
