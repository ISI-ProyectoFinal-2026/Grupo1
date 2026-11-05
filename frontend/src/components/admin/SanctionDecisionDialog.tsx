import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import Button from '@/components/ui/Button'

const MAX_REASON_LENGTH = 500

interface SanctionDecisionDialogProps {
  action: 'confirm' | 'revert'
  accountName: string
  isLoading: boolean
  onSubmit: (reason: string) => void
  onCancel: () => void
}

const COPY = {
  confirm: { title: 'Confirmar', label: 'Confirmar' },
  revert: { title: 'Revertir', label: 'Revertir' },
}

function SanctionDecisionDialog({
  action,
  accountName,
  isLoading,
  onSubmit,
  onCancel,
}: SanctionDecisionDialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !isLoading) onCancel()
  }

  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center'>
      <div
        ref={dialogRef}
        role='alertdialog'
        aria-modal='true'
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className='w-full max-w-md rounded-card bg-paper p-5 shadow-pop focus:outline-none sm:p-6'
      >
        <h2 id={titleId} className='font-display text-display-md'>
          {action === 'confirm' ? 'Confirmar' : 'Revertir'} el caso de {accountName}
        </h2>
        <p className='mt-2 text-ink-muted'>La decisión y el motivo quedan registrados.</p>
        <div className='mt-4 flex flex-col gap-1.5'>
          <label htmlFor='sanction-reason' className='field-label'>
            Motivo
          </label>
          <textarea
            id='sanction-reason'
            rows={3}
            maxLength={MAX_REASON_LENGTH}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className='field'
          />
        </div>
        <div className='mt-5 flex flex-col gap-2 sm:flex-row-reverse'>
          <Button
            variant={action === 'confirm' ? 'danger' : 'primary'}
            size='lg'
            isLoading={isLoading}
            disabled={trimmed.length === 0}
            onClick={() => onSubmit(trimmed)}
            className='w-full sm:w-auto'
          >
            {COPY[action].label}
          </Button>
          <Button
            variant='secondary'
            size='lg'
            disabled={isLoading}
            onClick={onCancel}
            className='w-full sm:w-auto'
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

export default SanctionDecisionDialog
