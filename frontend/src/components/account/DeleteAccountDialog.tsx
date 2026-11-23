import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { normalizeSecondFactorCode } from '@/utils/two-factor'
import type { SecondFactorMode } from '@/utils/two-factor'
import type { AccountDeleteInput } from '@/types/auth'

interface DeleteAccountDialogProps {
  needsCode: boolean
  isLoading: boolean
  error: string | null
  onConfirm: (input: AccountDeleteInput) => void
  onCancel: () => void
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled)'

// confirmación de la baja: reautentica con contraseña y, si hay 2FA, un código
function DeleteAccountDialog({
  needsCode,
  isLoading,
  error,
  onConfirm,
  onCancel,
}: DeleteAccountDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const passwordId = useId()
  const codeId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<SecondFactorMode>('totp')
  const isRecovery = mode === 'recovery'

  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onConfirm(needsCode ? { password, code: normalizeSecondFactorCode(mode, code) } : { password })
  }

  function toggleMode() {
    setMode(isRecovery ? 'totp' : 'recovery')
    setCode('')
  }

  // Escape cancela; Tab no sale del diálogo
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !isLoading) {
      onCancel()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return

    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 pb-[calc(1rem+var(--safe-bottom))] sm:items-center'>
      <div
        ref={dialogRef}
        role='alertdialog'
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className='max-h-full w-full max-w-md overflow-y-auto overscroll-contain rounded-card bg-paper p-5 shadow-pop focus:outline-none sm:p-6'
      >
        <h2 id={titleId} className='font-display text-display-md'>
          ¿Eliminar tu cuenta?
        </h2>
        <p id={descriptionId} className='mt-2 text-ink-muted'>
          Es definitivo y no se puede deshacer. Para confirmar, ingresá tu contraseña
          {needsCode ? ' y un código de verificación.' : '.'}
        </p>

        <form onSubmit={handleSubmit} className='mt-4 flex flex-col gap-4'>
          <div className='flex flex-col gap-1.5'>
            <label htmlFor={passwordId} className='field-label'>
              Contraseña
            </label>
            <input
              id={passwordId}
              type='password'
              required
              autoComplete='current-password'
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className='field'
            />
          </div>

          {needsCode && (
            <div className='flex flex-col gap-1.5'>
              <label htmlFor={codeId} className='field-label'>
                {isRecovery ? 'Código de recuperación' : 'Código de tu app'}
              </label>
              <input
                id={codeId}
                type='text'
                required
                spellCheck={false}
                inputMode={isRecovery ? 'text' : 'numeric'}
                autoComplete={isRecovery ? 'off' : 'one-time-code'}
                placeholder={isRecovery ? 'XXXXX-XXXXX' : '123456'}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className='field tabular font-bold tracking-widest'
              />
              <button
                type='button'
                onClick={toggleMode}
                className='inline-flex min-h-11 items-center self-start text-sm font-bold text-ink underline underline-offset-4 hover:no-underline'
              >
                {isRecovery ? 'Usar el código de mi app' : 'Usar un código de recuperación'}
              </button>
            </div>
          )}

          {error && <ErrorMessage message={error} />}

          <div className='flex flex-col gap-2 sm:flex-row-reverse'>
            <Button
              type='submit'
              variant='danger'
              size='lg'
              isLoading={isLoading}
              className='w-full sm:w-auto'
            >
              Eliminar definitivamente
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
        </form>
      </div>
    </div>
  )
}

export default DeleteAccountDialog
