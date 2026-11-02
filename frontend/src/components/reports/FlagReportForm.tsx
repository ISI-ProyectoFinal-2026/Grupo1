import { useState, type FormEvent } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { FlagIcon } from '@/components/ui/icons'

interface FlagReportFormProps {
  onSubmit: (reason: string) => void
  // textos e id del campo: también se usa para denunciar anuncios (#30)
  inputId?: string
  triggerLabel?: string
  formLabel?: string
  placeholder?: string
  isPending?: boolean
  isSent?: boolean
  // enviada o ya denunciada antes (409): no tiene sentido volver a intentar
  isDone?: boolean
  error?: string | null
}

export default function FlagReportForm({
  onSubmit,
  inputId = 'flag-reason',
  triggerLabel = 'Denunciar',
  formLabel = 'Denunciar reporte',
  placeholder = 'Ej: la foto no es de una mascota…',
  isPending = false,
  isSent = false,
  isDone = false,
  error = null,
}: FlagReportFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed) {
      setValidationError('Contanos el motivo de la denuncia.')
      return
    }
    setValidationError(null)
    onSubmit(trimmed)
  }

  return (
    <div className='flex flex-col gap-3'>
      <Button
        variant='ghost'
        className='w-full text-ink-muted hover:text-danger'
        aria-expanded={isOpen && !isDone}
        disabled={isDone}
        onClick={() => setIsOpen(true)}
      >
        <FlagIcon className='h-5 w-5' />
        {triggerLabel}
      </Button>

      {isOpen && !isDone && (
        <form
          aria-label={formLabel}
          noValidate
          onSubmit={handleSubmit}
          className='flex flex-col gap-3'
        >
          <Input
            id={inputId}
            name='reason'
            label='Motivo de la denuncia'
            autoComplete='off'
            placeholder={placeholder}
            value={reason}
            error={validationError ?? undefined}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className='grid grid-cols-2 gap-2'>
            <Button type='submit' variant='danger' isLoading={isPending}>
              Enviar denuncia
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={isPending}
              onClick={() => setIsOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {isSent && (
        <p role='status' className='text-sm font-bold text-success-ink'>
          Recibimos tu denuncia. Gracias por avisar.
        </p>
      )}
      {error && <ErrorMessage message={error} />}
    </div>
  )
}
