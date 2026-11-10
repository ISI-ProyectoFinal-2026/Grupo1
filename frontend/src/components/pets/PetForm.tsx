import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ZodError } from 'zod'
import ActionErrorMessage from '@/components/auth/ActionErrorMessage'
import MultiImageUploader from '@/components/common/MultiImageUploader'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'
import Input from '@/components/ui/Input'
import { getApiErrorCode } from '@/services/api'
import type { CreatePetInput } from '@/types/pet.types'
import { MAX_PET_PHOTOS, createPetSchema } from '@/types/validators/pet.validator'

interface PetFormProps {
  initialValues?: Partial<CreatePetInput>
  submitLabel: string
  onSubmit: (input: CreatePetInput) => Promise<void>
}

type TextField = 'name' | 'species' | 'breed' | 'age' | 'color' | 'description' | 'microchipId'

const SPECIES_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  { value: 'dog', label: 'Perro' },
  { value: 'cat', label: 'Gato' },
  { value: 'other', label: 'Otra' },
]

export default function PetForm({ initialValues, submitLabel, onSubmit }: PetFormProps) {
  const [values, setValues] = useState<Record<TextField, string>>({
    name: initialValues?.name ?? '',
    species: initialValues?.species ?? '',
    breed: initialValues?.breed ?? '',
    age: initialValues?.age === undefined ? '' : String(initialValues.age),
    color: initialValues?.color ?? '',
    description: initialValues?.description ?? '',
    microchipId: initialValues?.microchipId ?? '',
  })
  const [photoUrls, setPhotoUrls] = useState<string[]>(initialValues?.photoUrls ?? [])
  const [isPhotoUploading, setIsPhotoUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null)

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setValues((prev) => ({ ...prev, [name]: value }))
    clearFieldError(name)
  }

  const handlePhotosChange = (urls: string[]) => {
    setPhotoUrls(urls)
    if (urls.length > 0) clearFieldError('photoUrls')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isPhotoUploading) return
    setFormError(null)
    setFormErrorCode(null)
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const age = values.age.trim() === '' ? undefined : Number(values.age)
      const validated = createPetSchema.parse({ ...values, age, photoUrls })
      await onSubmit(validated)
    } catch (err) {
      if (err instanceof ZodError) {
        const errors: Record<string, string> = {}
        for (const issue of err.issues) {
          const path = String(issue.path[0] ?? 'general')
          errors[path] ??= issue.message
        }
        setFieldErrors(errors)
        setFormError('Por favor, corregí los errores del formulario')
      } else if (err instanceof Error) {
        setFormError(err.message)
        setFormErrorCode(getApiErrorCode(err) ?? null)
      } else {
        setFormError('No se pudo guardar la mascota')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const textInput = (field: TextField, label: string, props: Record<string, unknown> = {}) => (
    <div className='flex flex-col gap-2'>
      <Input
        label={label}
        id={field}
        name={field}
        autoComplete='off'
        value={values[field]}
        onChange={handleChange}
        aria-invalid={Boolean(fieldErrors[field])}
        {...props}
      />
      {fieldErrors[field] && <ErrorMessage message={fieldErrors[field]} />}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-6' noValidate>
      {formError && <ActionErrorMessage message={formError} code={formErrorCode} />}

      {textInput('name', 'Nombre *')}

      <div className='flex flex-col gap-1.5'>
        <label htmlFor='species' className='field-label'>
          Especie
        </label>
        <select
          id='species'
          name='species'
          value={values.species}
          onChange={handleChange}
          className='field'
        >
          {SPECIES_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {textInput('breed', 'Raza *')}
      {textInput('age', 'Edad (años) *', { type: 'number', min: 0, step: 1, inputMode: 'numeric' })}
      {textInput('color', 'Color *')}

      <div className='flex flex-col gap-1.5'>
        <label htmlFor='description' className='field-label'>
          Descripción *
        </label>
        <textarea
          id='description'
          name='description'
          placeholder='Señas particulares, collar, carácter…'
          value={values.description}
          onChange={handleChange}
          rows={4}
          aria-invalid={Boolean(fieldErrors.description)}
          className='field resize-y'
        />
        {fieldErrors.description && <ErrorMessage message={fieldErrors.description} />}
      </div>

      {textInput('microchipId', 'Microchip')}

      <fieldset className='flex flex-col gap-3'>
        <legend className='field-label mb-1.5'>Fotos *</legend>
        <MultiImageUploader
          value={photoUrls}
          onChange={handlePhotosChange}
          max={MAX_PET_PHOTOS}
          onUploadingChange={setIsPhotoUploading}
          screenForAnimals
        />
        {fieldErrors.photoUrls && <ErrorMessage message={fieldErrors.photoUrls} />}
      </fieldset>

      <Button
        type='submit'
        variant='primary'
        size='lg'
        isLoading={isSubmitting}
        disabled={isPhotoUploading}
        className='w-full'
      >
        {submitLabel}
      </Button>
    </form>
  )
}
