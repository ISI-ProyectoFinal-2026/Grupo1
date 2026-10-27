import { createElement, type ReactNode } from 'react'
import { act } from '@testing-library/react'
import { vi } from 'vitest'

// doble de react-leaflet: jsdom no tiene layout y Leaflet no puede proyectar clicks
// uso: vi.mock('react-leaflet', () => import('@/test/react-leaflet-mock'))

type LatLng = { lat: number; lng: number }
type LatLngTuple = [number, number]
type ClickHandler = (event: { latlng: LatLng }) => void
type DragEndHandler = (event: { target: { getLatLng: () => LatLng } }) => void

// estado compartido entre el doble y el test
const state: {
  click?: ClickHandler
  dragEnd?: DragEndHandler
  zoom: number
  visible: LatLng | null
} = { zoom: 13, visible: null }

// el doble registra los handlers que recibe para que el test los dispare
function register(handlers: { click?: ClickHandler; dragEnd?: DragEndHandler }) {
  Object.assign(state, handlers)
}

export const mapSpy = { setView: vi.fn() }

export function resetLeafletMock() {
  state.click = undefined
  state.dragEnd = undefined
  state.zoom = 13
  state.visible = null
  mapSpy.setView.mockReset()
}

// fija el zoom y el unico punto que el mapa considera visible
export function setMapViewport(zoom: number, visible: LatLng | null = null) {
  state.zoom = zoom
  state.visible = visible
}

export function clickMap(lat: number, lng: number) {
  act(() => state.click?.({ latlng: { lat, lng } }))
}

export function dragPinTo(lat: number, lng: number) {
  act(() => state.dragEnd?.({ target: { getLatLng: () => ({ lat, lng }) } }))
}

export function MapContainer(props: { center: LatLngTuple; zoom: number; children?: ReactNode }) {
  return createElement(
    'div',
    { 'data-testid': 'map', 'data-center': props.center.join(','), 'data-zoom': props.zoom },
    props.children
  )
}

export function TileLayer() {
  return null
}

export function Marker(props: {
  position: LatLngTuple
  draggable?: boolean
  title?: string
  eventHandlers?: { dragend?: DragEndHandler }
  children?: ReactNode
}) {
  if (props.draggable) register({ dragEnd: props.eventHandlers?.dragend })
  return createElement(
    'div',
    {
      'data-testid': 'marker',
      'data-position': props.position.join(','),
      'data-draggable': String(Boolean(props.draggable)),
      title: props.title,
    },
    props.children
  )
}

export function Popup(props: { children?: ReactNode }) {
  return createElement('div', null, props.children)
}

export function useMap() {
  return {
    setView: mapSpy.setView,
    getZoom: () => state.zoom,
    getBounds: () => ({
      contains: ([lat, lng]: LatLngTuple) =>
        state.visible !== null && state.visible.lat === lat && state.visible.lng === lng,
    }),
  }
}

export function useMapEvents(handlers: { click?: ClickHandler }) {
  register({ click: handlers.click })
  return useMap()
}
