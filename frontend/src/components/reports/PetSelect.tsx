import { useMyPetsQuery } from '@/hooks/usePets'
import type { PetDTO } from '@/types/pet.types'

interface PetSelectProps {
  value?: number
  onChange: (petId: number | undefined) => void
}

function petLabel(pet: PetDTO) {
  const name = pet.name ?? 'Sin nombre'
  return pet.breed ? `${name} (${pet.breed})` : name
}

// optional: without pets (or if they fail to load) the field is hidden
export default function PetSelect({ value, onChange }: PetSelectProps) {
  const pets = useMyPetsQuery().data ?? []
  if (pets.length === 0) return null

  return (
    <div className='flex flex-col gap-1.5'>
      <label htmlFor='petId' className='field-label'>
        Mascota
      </label>
      <select
        id='petId'
        name='petId'
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className='field'
      >
        <option value=''>Ninguna</option>
        {pets.map((pet) => (
          <option key={pet.id} value={pet.id}>
            {petLabel(pet)}
          </option>
        ))}
      </select>
    </div>
  )
}
