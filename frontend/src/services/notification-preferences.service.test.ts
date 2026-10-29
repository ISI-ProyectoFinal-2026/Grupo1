import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'
import {
  getNotificationPreferences,
  setLocationConsent,
  updateLocation,
} from '@/services/notification-preferences.service'
import type { NotificationPreferencesDTO } from '@/types/notification-preferences.types'

vi.mock('@/services/api', () => ({
  api: { get: vi.fn(), put: vi.fn() },
}))

function respuesta<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

const preferencias: NotificationPreferencesDTO = {
  notifyMatch: true,
  notifyMessage: true,
  notifyStatusChange: true,
  notifyNearby: false,
  nearbyRadiusKm: 5,
  nearbyReportType: 'both',
  locationConsentStatus: null,
  locationConsentAt: null,
  location: null,
}

describe('notification-preferences.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getNotificationPreferences hace GET a /notification-preferences', async () => {
    vi.mocked(api.get).mockResolvedValue(respuesta(preferencias))

    const result = await getNotificationPreferences()

    expect(api.get).toHaveBeenCalledWith('/notification-preferences')
    expect(result).toEqual(preferencias)
  })

  it('setLocationConsent hace PUT a /location-consent con el status', async () => {
    const aceptada = { ...preferencias, locationConsentStatus: 'accepted' as const }
    vi.mocked(api.put).mockResolvedValue(respuesta(aceptada))

    const result = await setLocationConsent('accepted')

    expect(api.put).toHaveBeenCalledWith('/notification-preferences/location-consent', {
      status: 'accepted',
    })
    expect(result).toEqual(aceptada)
  })

  it('updateLocation hace PUT a /location con las coordenadas', async () => {
    vi.mocked(api.put).mockResolvedValue(respuesta(preferencias))

    const result = await updateLocation({ latitude: -34.6, longitude: -58.4 })

    expect(api.put).toHaveBeenCalledWith('/notification-preferences/location', {
      latitude: -34.6,
      longitude: -58.4,
    })
    expect(result).toEqual(preferencias)
  })
})
