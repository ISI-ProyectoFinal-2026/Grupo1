import { useEffect } from 'react'
import { useNotificationPreferences, useUpdateLocation } from '@/hooks/useNotificationPreferences'
import { useAuthStore } from '@/stores/auth.store'
import type { UpdateLocationInput } from '@/types/notification-preferences.types'

// una vez por carga de página: vive a nivel de módulo, no de componente
let syncedThisLoad = false

export function resetLocationSyncGuard() {
  syncedThisLoad = false
}

function getBrowserPosition(): Promise<UpdateLocationInput> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator) || !navigator.geolocation) {
      reject(new Error('geolocation no disponible'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      reject
    )
  })
}

// pide la ubicación y la envía; falla en silencio (permiso denegado, sin red, etc.)
export async function syncLocationOnce(send: (input: UpdateLocationInput) => Promise<unknown>) {
  if (syncedThisLoad) return
  syncedThisLoad = true
  try {
    await send(await getBrowserPosition())
  } catch {
    // la ubicación es opcional: nunca rompe la UI
  }
}

export function useLocationSync() {
  const isLoggedIn = useAuthStore((state) => Boolean(state.user))
  const { data } = useNotificationPreferences(isLoggedIn)
  const { mutateAsync } = useUpdateLocation()
  const accepted = data?.locationConsentStatus === 'accepted'

  useEffect(() => {
    if (accepted) void syncLocationOnce(mutateAsync)
  }, [accepted, mutateAsync])
}
