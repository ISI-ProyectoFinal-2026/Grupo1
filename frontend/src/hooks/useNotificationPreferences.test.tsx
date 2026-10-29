import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as service from '@/services/notification-preferences.service'
import {
  notificationPreferencesQueryKey,
  useNotificationPreferences,
  useSetLocationConsent,
  useUpdateLocation,
  useUpdateNotificationPreferences,
} from '@/hooks/useNotificationPreferences'
import type { NotificationPreferencesDTO } from '@/types/notification-preferences.types'

vi.mock('@/services/notification-preferences.service')

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

describe('useNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('expone la queryKey', () => {
    expect(notificationPreferencesQueryKey).toEqual(['notification-preferences'])
  })

  it('carga las preferencias cuando esta habilitado', async () => {
    vi.mocked(service.getNotificationPreferences).mockResolvedValue(preferencias)
    const { Wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useNotificationPreferences(true), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data).toEqual(preferencias))
  })

  it('no consulta si esta deshabilitado', () => {
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useNotificationPreferences(false), { wrapper: Wrapper })

    expect(service.getNotificationPreferences).not.toHaveBeenCalled()
  })

  it('useSetLocationConsent actualiza la query con la respuesta', async () => {
    const aceptada = { ...preferencias, locationConsentStatus: 'accepted' as const }
    vi.mocked(service.setLocationConsent).mockResolvedValue(aceptada)
    const { Wrapper, client } = createQueryWrapper()
    const { result } = renderHook(
      () => ({ query: useNotificationPreferences(false), mutation: useSetLocationConsent() }),
      { wrapper: Wrapper }
    )

    await act(async () => {
      await result.current.mutation.mutateAsync('accepted')
    })

    expect(service.setLocationConsent).toHaveBeenCalledWith('accepted')
    expect(client.getQueryData(notificationPreferencesQueryKey)).toEqual(aceptada)
  })

  it('useUpdateLocation actualiza la query con la respuesta', async () => {
    const conUbicacion = {
      ...preferencias,
      location: { latitude: -34.6, longitude: -58.4, updatedAt: '2026-10-01T10:00:00.000Z' },
    }
    vi.mocked(service.updateLocation).mockResolvedValue(conUbicacion)
    const { Wrapper, client } = createQueryWrapper()
    const { result } = renderHook(
      () => ({ query: useNotificationPreferences(false), mutation: useUpdateLocation() }),
      { wrapper: Wrapper }
    )

    await act(async () => {
      await result.current.mutation.mutateAsync({ latitude: -34.6, longitude: -58.4 })
    })

    expect(service.updateLocation).toHaveBeenCalledWith({ latitude: -34.6, longitude: -58.4 })
    expect(client.getQueryData(notificationPreferencesQueryKey)).toEqual(conUbicacion)
  })

  it('useUpdateNotificationPreferences actualiza la query con la respuesta', async () => {
    const actualizada = { ...preferencias, nearbyRadiusKm: 10 as const }
    vi.mocked(service.updateNotificationPreferences).mockResolvedValue(actualizada)
    const { Wrapper, client } = createQueryWrapper()
    const { result } = renderHook(
      () => ({
        query: useNotificationPreferences(false),
        mutation: useUpdateNotificationPreferences(),
      }),
      { wrapper: Wrapper }
    )

    await act(async () => {
      await result.current.mutation.mutateAsync({ nearbyRadiusKm: 10 })
    })

    expect(service.updateNotificationPreferences).toHaveBeenCalledWith({ nearbyRadiusKm: 10 })
    expect(client.getQueryData(notificationPreferencesQueryKey)).toEqual(actualizada)
  })
})
