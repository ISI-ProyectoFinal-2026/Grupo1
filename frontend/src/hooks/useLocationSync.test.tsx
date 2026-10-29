import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryWrapper } from '@/test/query-wrapper'
import * as service from '@/services/notification-preferences.service'
import { resetLocationSyncGuard, useLocationSync } from '@/hooks/useLocationSync'
import { useAuthStore } from '@/stores/auth.store'
import type { AuthUser } from '@/types/auth'
import type { NotificationPreferencesDTO } from '@/types/notification-preferences.types'

vi.mock('@/services/notification-preferences.service')

const usuario: AuthUser = {
  id: 7,
  email: 'franco@patitas.test',
  fullName: 'Franco',
  phone: null,
  role: 'usuario_regular',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function preferencias(status: 'accepted' | 'declined' | null): NotificationPreferencesDTO {
  return {
    notifyMatch: true,
    notifyMessage: true,
    notifyStatusChange: true,
    notifyNearby: false,
    nearbyRadiusKm: 5,
    nearbyReportType: 'both',
    locationConsentStatus: status,
    locationConsentAt: null,
    location: null,
  }
}

const getCurrentPosition = vi.fn()

function stubGeolocation() {
  getCurrentPosition.mockImplementation((ok: PositionCallback) =>
    ok({ coords: { latitude: -34.6, longitude: -58.4 } } as GeolocationPosition)
  )
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  })
}

describe('useLocationSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetLocationSyncGuard()
    stubGeolocation()
    useAuthStore.setState({ token: 'token', user: usuario })
    vi.mocked(service.updateLocation).mockResolvedValue(preferencias('accepted'))
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
    Reflect.deleteProperty(navigator, 'geolocation')
  })

  it('envia la ubicacion una sola vez si el consentimiento esta aceptado', async () => {
    vi.mocked(service.getNotificationPreferences).mockResolvedValue(preferencias('accepted'))
    const { Wrapper } = createQueryWrapper()

    const first = renderHook(() => useLocationSync(), { wrapper: Wrapper })
    await waitFor(() => expect(service.updateLocation).toHaveBeenCalledTimes(1))
    first.rerender()
    first.unmount()
    renderHook(() => useLocationSync(), { wrapper: Wrapper })
    await waitFor(() => expect(service.getNotificationPreferences).toHaveBeenCalled())

    expect(service.updateLocation).toHaveBeenCalledTimes(1)
    expect(service.updateLocation).toHaveBeenCalledWith({ latitude: -34.6, longitude: -58.4 })
  })

  it.each([['declined' as const], [null]])(
    'no envia nada con consentimiento %s',
    async (status) => {
      vi.mocked(service.getNotificationPreferences).mockResolvedValue(preferencias(status))
      const { Wrapper } = createQueryWrapper()

      renderHook(() => useLocationSync(), { wrapper: Wrapper })
      await waitFor(() => expect(service.getNotificationPreferences).toHaveBeenCalled())

      expect(getCurrentPosition).not.toHaveBeenCalled()
      expect(service.updateLocation).not.toHaveBeenCalled()
    }
  )

  it('no hace nada sin sesion', () => {
    useAuthStore.setState({ token: null, user: null })
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useLocationSync(), { wrapper: Wrapper })

    expect(service.getNotificationPreferences).not.toHaveBeenCalled()
  })

  it('no rompe si no existe navigator.geolocation', async () => {
    Reflect.deleteProperty(navigator, 'geolocation')
    vi.mocked(service.getNotificationPreferences).mockResolvedValue(preferencias('accepted'))
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useLocationSync(), { wrapper: Wrapper })
    await waitFor(() => expect(service.getNotificationPreferences).toHaveBeenCalled())

    expect(service.updateLocation).not.toHaveBeenCalled()
  })

  it('ignora silenciosamente la geolocalizacion denegada', async () => {
    vi.mocked(service.getNotificationPreferences).mockResolvedValue(preferencias('accepted'))
    getCurrentPosition.mockImplementation((_ok: PositionCallback, fail: PositionErrorCallback) =>
      fail({ code: 1 } as GeolocationPositionError)
    )
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useLocationSync(), { wrapper: Wrapper })
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled())

    expect(service.updateLocation).not.toHaveBeenCalled()
  })

  it('ignora silenciosamente el error de red al enviar', async () => {
    vi.mocked(service.getNotificationPreferences).mockResolvedValue(preferencias('accepted'))
    vi.mocked(service.updateLocation).mockRejectedValue(new Error('red'))
    const { Wrapper } = createQueryWrapper()

    renderHook(() => useLocationSync(), { wrapper: Wrapper })

    await waitFor(() => expect(service.updateLocation).toHaveBeenCalledTimes(1))
  })
})
