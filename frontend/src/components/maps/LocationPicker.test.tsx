import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LocationPicker from '@/components/maps/LocationPicker'
import { PILOT_ZONE_CENTER } from '@/lib/map'
import {
  clickMap,
  dragPinTo,
  mapSpy,
  resetLeafletMock,
  setMapViewport,
} from '@/test/react-leaflet-mock'

vi.mock('react-leaflet', () => import('@/test/react-leaflet-mock'))

function nominatim(city: string) {
  return { ok: true, json: async () => ({ address: { city } }) } as Response
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const fetchMock = vi.fn()

beforeEach(() => {
  resetLeafletMock()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LocationPicker: mapa', () => {
  it('arranca centrado en la zona del piloto y sin pin', () => {
    render(<LocationPicker onLocationSelect={vi.fn()} />)

    expect(screen.getByTestId('map')).toHaveAttribute('data-center', PILOT_ZONE_CENTER.join(','))
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument()
    expect(screen.queryByText('Ubicación seleccionada')).not.toBeInTheDocument()
  })

  it('tocar el mapa coloca un pin arrastrable y avisa las coordenadas al instante', () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    const onLocationSelect = vi.fn()
    render(<LocationPicker onLocationSelect={onLocationSelect} />)

    clickMap(-34.61, -68.33)

    const pin = screen.getByTestId('marker')
    expect(pin).toHaveAttribute('data-position', '-34.61,-68.33')
    expect(pin).toHaveAttribute('data-draggable', 'true')
    expect(onLocationSelect).toHaveBeenCalledWith({ lat: -34.61, lng: -68.33 }, '-34.6100, -68.3300')
    expect(screen.getByText('Ubicación seleccionada')).toBeInTheDocument()
  })

  it('reemplaza la etiqueta con la zona que devuelve Nominatim', async () => {
    fetchMock.mockResolvedValue(nominatim('San Rafael'))
    const onLocationSelect = vi.fn()
    render(<LocationPicker onLocationSelect={onLocationSelect} />)

    clickMap(-34.61, -68.33)

    expect(await screen.findByText('San Rafael')).toBeInTheDocument()
    expect(onLocationSelect).toHaveBeenLastCalledWith({ lat: -34.61, lng: -68.33 }, 'San Rafael')
    expect(fetchMock.mock.calls[0][0]).toContain('lat=-34.61&lon=-68.33')
  })

  it('arrastrar el pin actualiza la ubicacion elegida', () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    const onLocationSelect = vi.fn()
    render(<LocationPicker onLocationSelect={onLocationSelect} />)

    clickMap(-34.61, -68.33)
    dragPinTo(-34.62, -68.34)

    expect(screen.getByTestId('marker')).toHaveAttribute('data-position', '-34.62,-68.34')
    expect(onLocationSelect).toHaveBeenLastCalledWith({ lat: -34.62, lng: -68.34 }, '-34.6200, -68.3400')
  })

  // Nominatim puede responder fuera de orden: la zona de un pin viejo no puede
  // pisar la del pin actual.
  it('descarta la respuesta de Nominatim de un pin que ya se movio', async () => {
    const vieja = deferred<Response>()
    fetchMock.mockReturnValueOnce(vieja.promise).mockResolvedValueOnce(nominatim('Zona nueva'))
    const onLocationSelect = vi.fn()
    render(<LocationPicker onLocationSelect={onLocationSelect} />)

    clickMap(-34.61, -68.33)
    dragPinTo(-34.62, -68.34)
    expect(await screen.findByText('Zona nueva')).toBeInTheDocument()

    vieja.resolve(nominatim('Zona vieja'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 0))

    expect(screen.queryByText('Zona vieja')).not.toBeInTheDocument()
    expect(onLocationSelect).toHaveBeenLastCalledWith({ lat: -34.62, lng: -68.34 }, 'Zona nueva')
  })

  it('si Nominatim falla conserva las coordenadas como etiqueta', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'))
    const onLocationSelect = vi.fn()
    render(<LocationPicker onLocationSelect={onLocationSelect} />)

    clickMap(-34.61, -68.33)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(onLocationSelect).toHaveBeenCalledTimes(1)
    expect(screen.getByText('-34.6100, -68.3300')).toBeInTheDocument()
  })

  it('sin resolveAddress no consulta Nominatim', () => {
    const onLocationSelect = vi.fn()
    render(<LocationPicker onLocationSelect={onLocationSelect} resolveAddress={false} />)

    clickMap(-34.61, -68.33)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(onLocationSelect).toHaveBeenCalledWith({ lat: -34.61, lng: -68.33 }, '-34.6100, -68.3300')
    // sin zona resuelta las coordenadas no se repiten
    expect(screen.getAllByText('-34.6100, -68.3300')).toHaveLength(1)
  })

  it('acerca el mapa al pin si quedo lejos o con poco zoom', () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    render(<LocationPicker onLocationSelect={vi.fn()} />)

    clickMap(-34.61, -68.33)

    expect(mapSpy.setView).toHaveBeenCalledWith([-34.61, -68.33], 16)
  })

  it('no mueve el mapa si el pin ya esta a la vista con zoom suficiente', () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    setMapViewport(17, { lat: -34.61, lng: -68.33 })
    render(<LocationPicker onLocationSelect={vi.fn()} />)

    clickMap(-34.61, -68.33)

    expect(mapSpy.setView).not.toHaveBeenCalled()
  })
})

describe('LocationPicker: ubicacion inicial (edicion)', () => {
  const guardada = { lat: -31.42, lng: -64.18 }

  it('arranca con el pin en la ubicacion guardada y el mapa centrado ahi', () => {
    const onLocationSelect = vi.fn()
    render(
      <LocationPicker
        onLocationSelect={onLocationSelect}
        initialLocation={guardada}
        initialAddress='Nueva Córdoba'
      />
    )

    expect(screen.getByTestId('map')).toHaveAttribute('data-center', '-31.42,-64.18')
    expect(screen.getByTestId('map')).toHaveAttribute('data-zoom', '16')
    expect(screen.getByTestId('marker')).toHaveAttribute('data-position', '-31.42,-64.18')
    expect(screen.getByText('Ubicación seleccionada')).toBeInTheDocument()
    expect(screen.getByText('Nueva Córdoba')).toBeInTheDocument()
    expect(onLocationSelect).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mover el pin reemplaza la ubicacion guardada', () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    const onLocationSelect = vi.fn()
    render(
      <LocationPicker
        onLocationSelect={onLocationSelect}
        initialLocation={guardada}
        initialAddress='Nueva Córdoba'
      />
    )

    dragPinTo(-31.43, -64.19)

    expect(screen.getByTestId('marker')).toHaveAttribute('data-position', '-31.43,-64.19')
    expect(onLocationSelect).toHaveBeenCalledWith({ lat: -31.43, lng: -64.19 }, '-31.4300, -64.1900')
    expect(screen.queryByText('Nueva Córdoba')).not.toBeInTheDocument()
  })
})

describe('LocationPicker: ubicacion actual', () => {
  function stubGeolocation(impl: Geolocation['getCurrentPosition'] | undefined) {
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: impl ? { getCurrentPosition: impl } : undefined,
    })
  }

  it('coloca el pin en la posicion del dispositivo', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    stubGeolocation((success) =>
      success({ coords: { latitude: -34.6, longitude: -68.32 } } as GeolocationPosition)
    )
    const onLocationSelect = vi.fn()
    const user = userEvent.setup()
    render(<LocationPicker onLocationSelect={onLocationSelect} />)

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación actual/ }))

    expect(screen.getByTestId('marker')).toHaveAttribute('data-position', '-34.6,-68.32')
    expect(onLocationSelect).toHaveBeenCalledWith({ lat: -34.6, lng: -68.32 }, '-34.6000, -68.3200')
    expect(mapSpy.setView).toHaveBeenCalledWith([-34.6, -68.32], 16)
  })

  it('muestra el error si el navegador rechaza la geolocalizacion', async () => {
    stubGeolocation((_success, error) =>
      error?.({ message: 'User denied Geolocation' } as GeolocationPositionError)
    )
    const user = userEvent.setup()
    render(<LocationPicker onLocationSelect={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación actual/ }))

    expect(screen.getByText('Error de geolocalización: User denied Geolocation')).toBeInTheDocument()
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument()
  })

  it('avisa si el navegador no tiene geolocalizacion', async () => {
    stubGeolocation(undefined)
    const user = userEvent.setup()
    render(<LocationPicker onLocationSelect={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Usar mi ubicación actual/ }))

    expect(screen.getByText('Geolocalización no disponible en tu navegador')).toBeInTheDocument()
  })
})
