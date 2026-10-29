import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getNotificationPreferences,
  setLocationConsent,
  updateLocation,
} from '@/services/notification-preferences.service'
import type {
  LocationConsentStatus,
  NotificationPreferencesDTO,
  UpdateLocationInput,
} from '@/types/notification-preferences.types'

export const notificationPreferencesQueryKey = ['notification-preferences'] as const

export function useNotificationPreferences(enabled = true) {
  return useQuery({
    queryKey: notificationPreferencesQueryKey,
    queryFn: getNotificationPreferences,
    enabled,
  })
}

// ambas mutaciones devuelven las preferencias completas: se guardan en el caché
function useStoreResponse() {
  const queryClient = useQueryClient()
  return (data: NotificationPreferencesDTO) =>
    queryClient.setQueryData(notificationPreferencesQueryKey, data)
}

export function useSetLocationConsent() {
  const store = useStoreResponse()
  return useMutation({
    mutationFn: (status: LocationConsentStatus) => setLocationConsent(status),
    onSuccess: store,
  })
}

export function useUpdateLocation() {
  const store = useStoreResponse()
  return useMutation({
    mutationFn: (input: UpdateLocationInput) => updateLocation(input),
    onSuccess: store,
  })
}
