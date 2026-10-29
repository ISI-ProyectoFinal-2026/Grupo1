import { api } from './api'
import type {
  LocationConsentStatus,
  NotificationPreferencesInput,
  NotificationPreferencesDTO,
  UpdateLocationInput,
} from '@/types/notification-preferences.types'

const BASE = '/notification-preferences'

export async function getNotificationPreferences(): Promise<NotificationPreferencesDTO> {
  const { data } = await api.get<NotificationPreferencesDTO>(BASE)
  return data
}

export async function setLocationConsent(
  status: LocationConsentStatus
): Promise<NotificationPreferencesDTO> {
  const { data } = await api.put<NotificationPreferencesDTO>(`${BASE}/location-consent`, {
    status,
  })
  return data
}

export async function updateLocation(
  input: UpdateLocationInput
): Promise<NotificationPreferencesDTO> {
  const { data } = await api.put<NotificationPreferencesDTO>(`${BASE}/location`, input)
  return data
}

export async function updateNotificationPreferences(
  input: NotificationPreferencesInput
): Promise<NotificationPreferencesDTO> {
  const { data } = await api.put<NotificationPreferencesDTO>(BASE, input)
  return data
}
