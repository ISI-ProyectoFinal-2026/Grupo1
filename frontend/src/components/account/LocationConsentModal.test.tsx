import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LocationConsentModal from '@/components/account/LocationConsentModal'
import { resetLocationSyncGuard } from '@/hooks/useLocationSync'
import * as service from '@/services/notification-preferences.service'
import { useAuthStore } from '@/stores/auth.store'
import { createQueryWrapper } from '@/test/query-wrapper'
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

function renderModal() {
  const { Wrapper } = createQueryWrapper()
  const user = userEvent.setup()
  render(
    <Wrapper>
      <LocationConsentModal />
    </Wrapper>
  )
  return { user }
}

describe('LocationConsentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetLocationSyncGuard()
    getCurrentPosition.mockImplementation((ok: PositionCallback) =>
      ok({ coords: { latitude: -34.6, longitude: -58.4 } } as GeolocationPosition)
    )
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    })
    useAuthStore.setState({ token: 'token', user: usuario })
    vi.mocked(service.getNotificationPreferences).mockResolvedValue(preferencias(null))
    vi.mocked(service.setLocationConsent).mockImplementation(async (status) => preferencias(status))
    vi.mocked(service.updateLocation).mockResolvedValue(preferencias('accepted'))
  })

  afterEach(() => {
    useAuthStore.setState({ token: null, user: null })
    Reflect.deleteProperty(navigator, 'geolocation')
  })

  it('aparece cuando nunca se le preguntó', async () => {
    renderModal()

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName()
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeInTheDocument()
  })

  it.each([['accepted' as const], ['declined' as const]])(
    'no aparece con consentimiento %s',
    async (status) => {
      vi.mocked(service.getNotificationPreferences).mockResolvedValue(preferencias(status))

      renderModal()
      await waitFor(() => expect(service.getNotificationPreferences).toHaveBeenCalled())

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    }
  )

  it('no aparece sin sesión ni consulta al backend', () => {
    useAuthStore.setState({ token: null, user: null })

    renderModal()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(service.getNotificationPreferences).not.toHaveBeenCalled()
  })

  it('Aceptar registra el consentimiento y envía la ubicación', async () => {
    const { user } = renderModal()

    await user.click(await screen.findByRole('button', { name: 'Aceptar' }))

    await waitFor(() =>
      expect(service.updateLocation).toHaveBeenCalledWith({ latitude: -34.6, longitude: -58.4 })
    )
    expect(service.setLocationConsent).toHaveBeenCalledWith('accepted')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('Ahora no registra declined y no pide la ubicación', async () => {
    const { user } = renderModal()

    await user.click(await screen.findByRole('button', { name: 'Ahora no' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(service.setLocationConsent).toHaveBeenCalledWith('declined')
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(service.updateLocation).not.toHaveBeenCalled()
  })

  it('si el navegador deniega la ubicación, el consentimiento queda y el modal se cierra', async () => {
    getCurrentPosition.mockImplementation((_ok: PositionCallback, fail: PositionErrorCallback) =>
      fail({ code: 1 } as GeolocationPositionError)
    )
    const { user } = renderModal()

    await user.click(await screen.findByRole('button', { name: 'Aceptar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(service.setLocationConsent).toHaveBeenCalledWith('accepted')
    expect(service.updateLocation).not.toHaveBeenCalled()
  })

  it('si falla el registro, muestra el error y deja el modal abierto', async () => {
    vi.mocked(service.setLocationConsent).mockRejectedValue(new Error('fallo'))
    const { user } = renderModal()

    await user.click(await screen.findByRole('button', { name: 'Aceptar' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeEnabled()
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('deshabilita los botones mientras se registra', async () => {
    vi.mocked(service.setLocationConsent).mockReturnValue(new Promise(() => {}))
    const { user } = renderModal()

    await user.click(await screen.findByRole('button', { name: 'Aceptar' }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Aceptar/ })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeDisabled()
  })

  it('Ahora no muestra el spinner solo en ese botón', async () => {
    vi.mocked(service.setLocationConsent).mockReturnValue(new Promise(() => {}))
    const { user } = renderModal()

    await user.click(await screen.findByRole('button', { name: 'Ahora no' }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Ahora no/ })).toBeDisabled())
    expect(screen.getByRole('button', { name: /Ahora no/ })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Aceptar' })).not.toHaveAttribute('aria-busy')
  })

  it('Aceptar muestra el spinner solo en ese botón', async () => {
    vi.mocked(service.setLocationConsent).mockReturnValue(new Promise(() => {}))
    const { user } = renderModal()

    await user.click(await screen.findByRole('button', { name: 'Aceptar' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Aceptar/ })).toHaveAttribute('aria-busy', 'true')
    )
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ahora no' })).not.toHaveAttribute('aria-busy')
  })

  it('no se cierra con Escape ni con click afuera', async () => {
    const { user } = renderModal()
    await screen.findByRole('dialog')

    await user.keyboard('{Escape}')
    await user.click(document.body)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(service.setLocationConsent).not.toHaveBeenCalled()
  })
})
