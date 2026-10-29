import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { syncLocationOnce } from '@/hooks/useLocationSync'
import {
  useNotificationPreferences,
  useSetLocationConsent,
  useUpdateLocation,
} from '@/hooks/useNotificationPreferences'
import { useAuthStore } from '@/stores/auth.store'

const FOCUSABLE = 'button:not(:disabled)'
const ERROR_MESSAGE = 'No pudimos guardar tu elección. Probá de nuevo.'

/**
 * Pregunta una sola vez si se puede usar la ubicación. No se cierra con Escape
 * ni con un click en el fondo: la decisión se registra solo con los botones.
 */
function LocationConsentModal() {
  const isLoggedIn = useAuthStore((state) => Boolean(state.user))
  const { data, isSuccess } = useNotificationPreferences(isLoggedIn)
  const setConsent = useSetLocationConsent()
  const updateLocation = useUpdateLocation()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const isOpen = isLoggedIn && isSuccess && data.locationConsentStatus === null

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  async function handleChoice(status: 'accepted' | 'declined') {
    setError(null)
    try {
      await setConsent.mutateAsync(status)
    } catch {
      setError(ERROR_MESSAGE)
      return
    }
    // el consentimiento ya quedó registrado: si el navegador deniega, no hay error
    if (status === 'accepted') await syncLocationOnce(updateLocation.mutateAsync)
  }

  // El foco se queda adentro del modal mientras está abierto.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
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

  const isLoading = setConsent.isPending

  return (
    <div
      data-testid='location-consent-overlay'
      className='fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center'
    >
      <div
        ref={dialogRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className='max-h-full w-full max-w-md overflow-y-auto overscroll-contain rounded-card bg-paper p-5 shadow-pop focus:outline-none sm:p-6'
      >
        <h2 id={titleId} className='font-display text-display-md'>
          ¿Querés que te avisemos de reportes cerca tuyo?
        </h2>
        <p className='mt-2 text-ink-muted'>
          Usamos tu ubicación para avisarte cuando se publica un reporte nuevo cerca de donde estás.
          Guardamos solamente tu última ubicación, y podés cambiarlo cuando quieras en
          Notificaciones.
        </p>

        {error && <ErrorMessage message={error} className='mt-3' />}

        <div className='mt-5 flex flex-col gap-2 sm:flex-row-reverse'>
          <Button
            variant='primary'
            size='lg'
            disabled={isLoading}
            isLoading={isLoading && setConsent.variables === 'accepted'}
            onClick={() => handleChoice('accepted')}
            className='w-full sm:w-auto'
          >
            Aceptar
          </Button>
          <Button
            variant='secondary'
            size='lg'
            disabled={isLoading}
            isLoading={isLoading && setConsent.variables === 'declined'}
            onClick={() => handleChoice('declined')}
            className='w-full sm:w-auto'
          >
            Ahora no
          </Button>
        </div>
      </div>
    </div>
  )
}

export default LocationConsentModal
