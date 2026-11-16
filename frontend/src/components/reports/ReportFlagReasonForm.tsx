import { useState, type FormEvent } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { FlagIcon } from '@/components/ui/icons'
import { REPORT_FLAG_REASONS, REPORT_FLAG_REASON_LABELS } from '@/lib/report-flag-reasons'
import type { CreateReportFlagInput, ReportFlagReason } from '@/types/moderation.types'

const DETAIL_MAX_LENGTH = 500

interface ReportFlagReasonFormProps {
  onSubmit: (input: CreateReportFlagInput) => void
  isPending?: boolean
  isSent?: boolean
  // enviada o rechazada sin sentido de reintento (409, 404, 403)
  isDone?: boolean
  error?: string | null
}

// denuncia de reportes con motivo tipificado; los anuncios usan FlagReportForm (#30)
export default function ReportFlagReasonForm({
  onSubmit,
  isPending = false,
  isSent = false,
  isDone = false,
  error = null,
}: ReportFlagReasonFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState<ReportFlagReason | ''>('')
  const [detail, setDetail] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setReasonError(null)
    setDetailError(null)
    if (!reason) {
      setReasonError('Elegí un motivo para la denuncia.')
      return
    }
    if (reason !== 'other') {
      onSubmit({ reason })
      return
    }
    const trimmed = detail.trim()
    if (!trimmed) {
      setDetailError('Contanos el motivo de la denuncia.')
      return
    }
    onSubmit({ reason, detail: trimmed })
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
        Denunciar
      </Button>

      {isOpen && !isDone && (
        <form aria-label='Denunciar reporte' noValidate onSubmit={handleSubmit} className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1.5'>
            <label htmlFor='flag-reason' className='field-label'>
              Motivo de la denuncia
            </label>
            <select
              id='flag-reason'
              name='reason'
              value={reason}
              aria-invalid={!!reasonError}
              onChange={(event) => setReason(event.target.value as ReportFlagReason | '')}
              className='field'
            >
              <option value=''>Elegí un motivo</option>
              {REPORT_FLAG_REASONS.map((value) => (
                <option key={value} value={value}>
                  {REPORT_FLAG_REASON_LABELS[value]}
                </option>
              ))}
            </select>
            {reasonError && <span className='text-sm font-bold text-danger'>{reasonError}</span>}
          </div>
          {reason === 'other' && (
            <Input
              id='flag-detail'
              name='detail'
              label='Detalle'
              autoComplete='off'
              maxLength={DETAIL_MAX_LENGTH}
              placeholder='Contanos qué pasa con este reporte'
              value={detail}
              error={detailError ?? undefined}
              onChange={(event) => setDetail(event.target.value)}
            />
          )}
          <div className='grid grid-cols-2 gap-2'>
            <Button type='submit' variant='danger' isLoading={isPending}>
              Enviar denuncia
            </Button>
            <Button type='button' variant='secondary' disabled={isPending} onClick={() => setIsOpen(false)}>
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
