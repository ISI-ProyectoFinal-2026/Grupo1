import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import Button from '@/components/ui/Button'
import { ROLE_LABELS, type AdminUser } from '@/types/admin.types'
import type { Role } from '@/types/auth'

interface ConfirmRoleChangeDialogProps {
  target: AdminUser
  newRole: Role
  isLoading: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmRoleChangeDialog({
  target,
  newRole,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmRoleChangeDialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

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
          ¿Cambiar el rol de {target.fullName ?? target.email}?
        </h2>
        <p className='mt-2 text-ink-muted'>
          Pasa de {ROLE_LABELS[target.role]} a {ROLE_LABELS[newRole]}. Le vamos a avisar por
          notificación y el cambio queda registrado.
        </p>
        <div className='mt-5 flex flex-col gap-2 sm:flex-row-reverse'>
          <Button
            variant='primary'
            size='lg'
            isLoading={isLoading}
            onClick={onConfirm}
            className='w-full sm:w-auto'
          >
            Confirmar
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

export default ConfirmRoleChangeDialog
