import { useState, type FormEvent } from 'react'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { UserIcon } from '@/components/ui/icons'
import { useReportAccount } from '@/hooks/useAccountReports'
import { ACCOUNT_REPORT_SEVERITIES, ACCOUNT_REPORT_SEVERITY_LABELS } from '@/lib/account-report-severity'
import type { AccountReportSeverity } from '@/types/moderation.types'

interface ReportAccountFormProps {
  reportedUserId: number
}

// mismo flujo que FlagReportForm, con gravedad en lugar de motivo (#267)
export default function ReportAccountForm({ reportedUserId }: ReportAccountFormProps) {
  const accountReport = useReportAccount(reportedUserId)
  const [isOpen, setIsOpen] = useState(false)
  const [severity, setSeverity] = useState<AccountReportSeverity | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!severity) {
      setValidationError('Elegí la gravedad del problema.')
      return
    }
    setValidationError(null)
    accountReport.report(severity)
  }

  return (
    <div className='flex flex-col gap-3'>
      <Button
        variant='ghost'
        className='w-full text-ink-muted hover:text-danger'
        aria-expanded={isOpen && !accountReport.isDone}
        disabled={accountReport.isDone}
        onClick={() => setIsOpen(true)}
      >
        <UserIcon className='h-5 w-5' />
        Reportar cuenta
      </Button>

      {isOpen && !accountReport.isDone && (
        <form aria-label='Reportar cuenta del autor' noValidate onSubmit={handleSubmit} className='flex flex-col gap-3'>
          <fieldset className='flex flex-col gap-2'>
            <legend className='field-label mb-1'>Gravedad del problema</legend>
            <div className='grid grid-cols-3 gap-2'>
              {ACCOUNT_REPORT_SEVERITIES.map((option) => (
                <label
                  key={option}
                  className={`card flex cursor-pointer items-center justify-center gap-2 px-2 py-3 font-bold ${
                    severity === option ? 'ring-2 ring-ink' : ''
                  }`}
                >
                  <input
                    type='radio'
                    name='severity'
                    value={option}
                    checked={severity === option}
                    onChange={() => setSeverity(option)}
                  />
                  {ACCOUNT_REPORT_SEVERITY_LABELS[option]}
                </label>
              ))}
            </div>
            {validationError && <p className='text-sm font-bold text-danger'>{validationError}</p>}
          </fieldset>
          <div className='grid grid-cols-2 gap-2'>
            <Button type='submit' variant='danger' isLoading={accountReport.isPending}>
              Enviar reporte
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={accountReport.isPending}
              onClick={() => setIsOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {accountReport.isSent && (
        <p role='status' className='text-sm font-bold text-success-ink'>
          Recibimos tu reporte. Gracias por avisar.
        </p>
      )}
      {accountReport.error && <ErrorMessage message={accountReport.error} />}
    </div>
  )
}
