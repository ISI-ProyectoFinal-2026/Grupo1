import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationSettingsPage from '@/pages/account/NotificationSettingsPage'
import { resetLocationSyncGuard, syncLocationOnce } from '@/hooks/useLocationSync'
import * as service from '@/services/notification-preferences.service'
import { createQueryWrapper } from '@/test/query-wrapper'
import type { NotificationPreferencesDTO } from '@/types/notification-preferences.types'

vi.mock('@/services/notification-preferences.service')

function preferencias(
  overrides: Partial<NotificationPreferencesDTO> = {}
): NotificationPreferencesDTO {
  return {
    notifyMatch: true,
    notifyMessage: true,
    notifyStatusChange: true,
    notifyNearby: true,
    nearbyRadiusKm: 5,
    nearbyReportType: 'both',
    locationConsentStatus: 'accepted',
    locationConsentAt: '2026-10-01T10:00:00.000Z',
    location: { latitude: -34.6, longitude: -58.4, updatedAt: '2026-10-01T10:00:00.000Z' },
    ...overrides,
  }
}

const getCurrentPosition = vi.fn()

function renderPage() {
  const { Wrapper } = createQueryWrapper()
  const user = userEvent.setup()
  render(
    <Wrapper>
      <NotificationSettingsPage />
    </Wrapper>
  )
  return { user }
}

describe('NotificationSettingsPage', () => {
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
    vi.mocked(service.getNotificationPreferences).mockResolvedValue(preferencias())
    vi.mocked(service.updateNotificationPreferences).mockImplementation(async (input) =>
      preferencias(input)
    )
    vi.mocked(service.setLocationConsent).mockImplementation(async (status) =>
      preferencias({ locationConsentStatus: status })
    )
    vi.mocked(service.updateLocation).mockResolvedValue(preferencias())
  })

  afterEach(() => {
    resetLocationSyncGuard()
    Reflect.deleteProperty(navigator, 'geolocation')
  })

  it('muestra un spinner mientras carga', () => {
    vi.mocked(service.getNotificationPreferences).mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument()
  })

  it('si falla la carga, muestra el error y permite reintentar', async () => {
    vi.mocked(service.getNotificationPreferences).mockRejectedValueOnce(new Error('sin conexión'))
    const { user } = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('sin conexión')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('switch', { name: 'Mensaje nuevo' })).toBeChecked()
  })

  it('muestra un interruptor por cada tipo con el valor del servidor', async () => {
    vi.mocked(service.getNotificationPreferences).mockResolvedValue(
      preferencias({ notifyMessage: false })
    )

    renderPage()

    expect(await screen.findByRole('switch', { name: 'Posible coincidencia' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Mensaje nuevo' })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Cambio de estado de mi reporte' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Nuevo reporte en mi zona' })).toBeChecked()
  })

  it('al cambiar un interruptor hace un PUT con ese campo y confirma', async () => {
    const { user } = renderPage()

    await user.click(await screen.findByRole('switch', { name: 'Mensaje nuevo' }))

    await waitFor(() =>
      expect(service.updateNotificationPreferences).toHaveBeenCalledWith({ notifyMessage: false })
    )
    expect(service.updateNotificationPreferences).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Guardamos tus cambios')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Mensaje nuevo' })).not.toBeChecked()
  })

  it('deshabilita los controles mientras corre la mutación', async () => {
    vi.mocked(service.updateNotificationPreferences).mockReturnValue(new Promise(() => {}))
    const { user } = renderPage()

    await user.click(await screen.findByRole('switch', { name: 'Mensaje nuevo' }))

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Mensaje nuevo' })).toBeDisabled()
    )
    expect(screen.getByRole('switch', { name: 'Posible coincidencia' })).toBeDisabled()
    expect(screen.getByLabelText('Radio')).toBeDisabled()
  })

  it('si falla el guardado, muestra el error y el control vuelve al valor del servidor', async () => {
    vi.mocked(service.updateNotificationPreferences).mockRejectedValue(
      new Error('Activá la ubicación para recibir avisos de tu zona')
    )
    const { user } = renderPage()

    await user.click(await screen.findByRole('switch', { name: 'Mensaje nuevo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Activá la ubicación para recibir avisos de tu zona'
    )
    expect(screen.getByRole('switch', { name: 'Mensaje nuevo' })).toBeChecked()
    expect(screen.queryByText('Guardamos tus cambios')).not.toBeInTheDocument()
  })

  it('cambia el radio y el tipo de reporte', async () => {
    const { user } = renderPage()

    await user.selectOptions(await screen.findByLabelText('Radio'), '10')
    await waitFor(() =>
      expect(service.updateNotificationPreferences).toHaveBeenCalledWith({ nearbyRadiusKm: 10 })
    )
    await user.selectOptions(screen.getByLabelText('Tipo de reporte'), 'lost')

    await waitFor(() =>
      expect(service.updateNotificationPreferences).toHaveBeenCalledWith({
        nearbyReportType: 'lost',
      })
    )
  })

  it('radio y tipo de reporte quedan deshabilitados si el aviso de zona está apagado', async () => {
    vi.mocked(service.getNotificationPreferences).mockResolvedValue(
      preferencias({ notifyNearby: false })
    )

    renderPage()

    expect(await screen.findByLabelText('Radio')).toBeDisabled()
    expect(screen.getByLabelText('Tipo de reporte')).toBeDisabled()
  })

  it('con consentimiento aceptado muestra el estado y permite dejar de compartir', async () => {
    const { user } = renderPage()

    expect(await screen.findByText('Compartís tu ubicación')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activar ubicación' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dejar de compartir mi ubicación' }))

    await waitFor(() => expect(service.setLocationConsent).toHaveBeenCalledWith('declined'))
    expect(await screen.findByRole('button', { name: 'Activar ubicación' })).toBeInTheDocument()
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('al dejar de compartir, el interruptor de zona refleja lo que devuelve el backend', async () => {
    vi.mocked(service.setLocationConsent).mockResolvedValue(
      preferencias({ locationConsentStatus: 'declined', notifyNearby: false, location: null })
    )
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Dejar de compartir mi ubicación' }))

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Nuevo reporte en mi zona' })).not.toBeChecked()
    )
  })

  it.each([['declined' as const], [null]])(
    'sin consentimiento (%s) el interruptor de zona no se puede activar',
    async (status) => {
      vi.mocked(service.getNotificationPreferences).mockResolvedValue(
        preferencias({ locationConsentStatus: status, notifyNearby: false, location: null })
      )

      renderPage()

      expect(await screen.findByRole('switch', { name: 'Nuevo reporte en mi zona' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Activar ubicación' })).toBeInTheDocument()
      expect(service.updateNotificationPreferences).not.toHaveBeenCalled()
    }
  )

  it('Activar ubicación registra accepted y sincroniza la ubicación', async () => {
    vi.mocked(service.getNotificationPreferences).mockResolvedValue(
      preferencias({ locationConsentStatus: null, notifyNearby: false, location: null })
    )
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Activar ubicación' }))

    await waitFor(() => expect(service.setLocationConsent).toHaveBeenCalledWith('accepted'))
    await waitFor(() =>
      expect(service.updateLocation).toHaveBeenCalledWith({ latitude: -34.6, longitude: -58.4 })
    )
    expect(await screen.findByText('Compartís tu ubicación')).toBeInTheDocument()
  })

  it('tras dejar de compartir, volver a activar reenvía la ubicación en la misma carga', async () => {
    await syncLocationOnce(service.updateLocation)
    expect(service.updateLocation).toHaveBeenCalledTimes(1)
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Dejar de compartir mi ubicación' }))
    await user.click(await screen.findByRole('button', { name: 'Activar ubicación' }))

    await waitFor(() => expect(service.updateLocation).toHaveBeenCalledTimes(2))
    expect(service.updateLocation).toHaveBeenLastCalledWith({ latitude: -34.6, longitude: -58.4 })
  })

  it('si falla el registro del consentimiento, muestra el error', async () => {
    vi.mocked(service.getNotificationPreferences).mockResolvedValue(
      preferencias({ locationConsentStatus: null, notifyNearby: false, location: null })
    )
    vi.mocked(service.setLocationConsent).mockRejectedValue(new Error('fallo de red'))
    const { user } = renderPage()

    await user.click(await screen.findByRole('button', { name: 'Activar ubicación' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('fallo de red')
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })
})
