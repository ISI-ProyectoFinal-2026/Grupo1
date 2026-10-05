import { useState, type FormEvent } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ErrorMessage from '@/components/ui/ErrorMessage'

interface FlagReportFormProps {
  onSubmit: (reason: string) => void
  isPending?: boolean
  isSent?: boolean
  // enviada o ya denunciada antes (409): no tiene sentido volver a intentar
  isDone?: boolean
  error?: string | null
}

export default function FlagReportForm({
  onSubmit,
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
        variant='secondary'
        className='self-start'
        aria-expanded={isOpen && !isDone}
        disabled={isDone}
        onClick={() => setIsOpen(true)}
      >
        Denunciar
      </Button>

      {isOpen && !isDone && (
        <form
          aria-label='Denunciar reporte'
          noValidate
          onSubmit={handleSubmit}
          className='flex flex-col gap-3'
        >
          <Input
            id='flag-reason'
            name='reason'
            label='Motivo de la denuncia'
            value={reason}
            error={validationError ?? undefined}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className='flex gap-3'>
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
        <p role='status' className='text-sm text-green-700'>
          Recibimos tu denuncia. Gracias por avisar.
        </p>
      )}
      {error && <ErrorMessage message={error} />}
    </div>
  )
}
