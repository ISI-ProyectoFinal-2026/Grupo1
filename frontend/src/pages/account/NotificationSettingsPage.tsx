import { useState } from 'react'
import ErrorMessage from '@/components/ui/ErrorMessage'
import Spinner from '@/components/ui/Spinner'
import SuccessMessage from '@/components/ui/SuccessMessage'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { resetLocationSyncGuard, syncLocationOnce } from '@/hooks/useLocationSync'
import {
  useNotificationPreferences,
  useSetLocationConsent,
  useUpdateLocation,
  useUpdateNotificationPreferences,
} from '@/hooks/useNotificationPreferences'
import type {
  NearbyRadiusKm,
  NearbyReportType,
  NotificationPreferencesDTO,
  NotificationPreferencesInput,
} from '@/types/notification-preferences.types'

type ToggleKey = 'notifyMatch' | 'notifyMessage' | 'notifyStatusChange' | 'notifyNearby'

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  {
    key: 'notifyMatch',
    label: 'Posible coincidencia',
    hint: 'Cuando encontramos una coincidencia con tu reporte.',
  },
  { key: 'notifyMessage', label: 'Mensaje nuevo', hint: 'Cuando alguien te escribe en un chat.' },
  {
    key: 'notifyStatusChange',
    label: 'Cambio de estado de mi reporte',
    hint: 'Cuando se cierra o cambia el estado de uno de tus reportes.',
  },
  {
    key: 'notifyNearby',
    label: 'Nuevo reporte en mi zona',
    hint: 'Cuando se publica un reporte cerca de tu última ubicación.',
  },
]

const RADIUS_OPTIONS: NearbyRadiusKm[] = [1, 2, 5, 10]
const REPORT_TYPE_OPTIONS: { value: NearbyReportType; label: string }[] = [
  { value: 'lost', label: 'Perdidos' },
  { value: 'found', label: 'Encontrados' },
  { value: 'both', label: 'Ambos' },
]

const FALLBACK_ERROR = 'No pudimos guardar el cambio. Probá de nuevo.'
const SELECT_CLASS =
  'min-h-11 w-full rounded-control border border-line bg-paper px-3 text-ink disabled:opacity-50'

function NotificationSettingsPage() {
  const preferences = useNotificationPreferences(true)
  const updatePreferences = useUpdateNotificationPreferences()
  const setConsent = useSetLocationConsent()
  const updateLocation = useUpdateLocation()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const isBusy = updatePreferences.isPending || setConsent.isPending

  async function run(action: () => Promise<unknown>) {
    setError(null)
    setSaved(false)
    try {
      await action()
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : FALLBACK_ERROR)
    }
  }

  const save = (input: NotificationPreferencesInput) =>
    run(() => updatePreferences.mutateAsync(input))

  const activateLocation = () =>
    run(async () => {
      await setConsent.mutateAsync('accepted')
      await syncLocationOnce(updateLocation.mutateAsync)
    })

  const stopSharing = () =>
    run(async () => {
      await setConsent.mutateAsync('declined')
      // permite volver a enviar la ubicación si se reactiva en esta misma carga
      resetLocationSyncGuard()
    })

  function renderContent(data: NotificationPreferencesDTO) {
    const hasConsent = data.locationConsentStatus === 'accepted'

    return (
      <>
        <ul className='mt-6 flex flex-col gap-3'>
          {TOGGLES.map(({ key, label, hint }) => {
            const isNearby = key === 'notifyNearby'
            return (
              <li key={key}>
                <label className='flex min-h-11 cursor-pointer items-start gap-3 rounded-card border border-line bg-surface p-3'>
                  <input
                    type='checkbox'
                    role='switch'
                    aria-labelledby={`${key}-label`}
                    aria-describedby={`${key}-hint`}
                    checked={data[key]}
                    disabled={isBusy || (isNearby && !hasConsent)}
                    onChange={(event) => save({ [key]: event.target.checked })}
                    className='mt-1 h-5 w-5 shrink-0 accent-ink'
                  />
                  <span className='flex flex-col'>
                    <span id={`${key}-label`} className='font-bold text-ink'>
                      {label}
                    </span>
                    <span id={`${key}-hint`} className='text-sm text-ink-muted'>
                      {hint}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        <section aria-labelledby='zona-title' className='mt-8'>
          <h2 id='zona-title' className='font-display text-display-sm text-ink'>
            Nuevo reporte en mi zona
          </h2>
          <div className='mt-3 grid gap-3 sm:grid-cols-2'>
            <div>
              <label htmlFor='nearby-radius' className='mb-1 block text-sm font-bold text-ink'>
                Radio
              </label>
              <select
                id='nearby-radius'
                value={data.nearbyRadiusKm}
                disabled={isBusy || !data.notifyNearby}
                onChange={(event) =>
                  save({ nearbyRadiusKm: Number(event.target.value) as NearbyRadiusKm })
                }
                className={SELECT_CLASS}
              >
                {RADIUS_OPTIONS.map((km) => (
                  <option key={km} value={km}>
                    {km} km
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor='nearby-type' className='mb-1 block text-sm font-bold text-ink'>
                Tipo de reporte
              </label>
              <select
                id='nearby-type'
                value={data.nearbyReportType}
                disabled={isBusy || !data.notifyNearby}
                onChange={(event) =>
                  save({ nearbyReportType: event.target.value as NearbyReportType })
                }
                className={SELECT_CLASS}
              >
                {REPORT_TYPE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section aria-labelledby='ubicacion-title' className='mt-8'>
          <h2 id='ubicacion-title' className='font-display text-display-sm text-ink'>
            Ubicación
          </h2>
          {hasConsent ? (
            <div className='mt-2 flex flex-col items-start gap-3'>
              <p className='text-ink-muted'>Compartís tu ubicación</p>
              <button
                type='button'
                onClick={stopSharing}
                disabled={isBusy}
                className={buttonClasses('secondary')}
              >
                Dejar de compartir mi ubicación
              </button>
            </div>
          ) : (
            <div className='mt-2 flex flex-col items-start gap-3'>
              <p className='text-ink-muted'>
                La usamos solo para avisarte de reportes nuevos cerca tuyo. Guardamos únicamente tu
                última ubicación.
              </p>
              <button
                type='button'
                onClick={activateLocation}
                disabled={isBusy}
                className={buttonClasses('primary')}
              >
                Activar ubicación
              </button>
            </div>
          )}
        </section>

        <div className='mt-6 flex flex-col gap-2'>
          {error && <ErrorMessage message={error} />}
          {saved && !error && <SuccessMessage message='Guardamos tus cambios' />}
        </div>
      </>
    )
  }

  function renderBody() {
    if (preferences.data) return renderContent(preferences.data)
    if (preferences.isError) {
      return (
        <div className='mt-6 flex flex-col items-start gap-3'>
          <ErrorMessage message={preferences.error.message} />
          <button
            type='button'
            onClick={() => preferences.refetch()}
            className={buttonClasses('secondary')}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return (
      <div className='mt-6 flex justify-center py-10 text-ink-muted'>
        <Spinner />
      </div>
    )
  }

  return (
    <div className='px-4 py-5 sm:px-6 lg:py-8'>
      <div className='mx-auto max-w-xl'>
        <h1 className='font-display text-display-lg'>Notificaciones</h1>
        {renderBody()}
      </div>
    </div>
  )
}

export default NotificationSettingsPage
