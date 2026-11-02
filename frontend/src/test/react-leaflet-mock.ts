import { createElement, type ReactNode } from 'react'
import { act } from '@testing-library/react'
import { vi } from 'vitest'

// doble de react-leaflet: jsdom no tiene layout y Leaflet no puede proyectar clicks
// uso: vi.mock('react-leaflet', () => import('@/test/react-leaflet-mock'))

type LatLng = { lat: number; lng: number }
type LatLngTuple = [number, number]
type ClickHandler = (event: { latlng: LatLng }) => void
type DragEndHandler = (event: { target: { getLatLng: () => LatLng } }) => void
type MoveEndHandler = () => void
type Bounds = { south: number; west: number; north: number; east: number }

const DEFAULT_BOUNDS: Bounds = { south: -34.7, west: -68.4, north: -34.5, east: -68.2 }

// estado compartido entre el doble y el test
const state: {
  click?: ClickHandler
  dragEnd?: DragEndHandler
  moveEnd?: MoveEndHandler
  zoom: number
  visible: LatLng | null
  bounds: Bounds
} = { zoom: 13, visible: null, bounds: DEFAULT_BOUNDS }

// el doble registra los handlers que recibe para que el test los dispare
function register(handlers: { click?: ClickHandler; dragEnd?: DragEndHandler; moveEnd?: MoveEndHandler }) {
  for (const [key, handler] of Object.entries(handlers)) {
    if (handler) Object.assign(state, { [key]: handler })
  }
}

export const mapSpy = { setView: vi.fn() }

export function resetLeafletMock() {
  state.click = undefined
  state.dragEnd = undefined
  state.moveEnd = undefined
  state.zoom = 13
  state.visible = null
  state.bounds = DEFAULT_BOUNDS
  mapSpy.setView.mockReset()
}

// mueve el mapa: fija el area visible y dispara moveend como lo hace Leaflet
export function moveMapTo(bounds: Bounds) {
  state.bounds = bounds
  act(() => {
    state.moveEnd?.()
  })
}

// fija el zoom y el unico punto que el mapa considera visible
export function setMapViewport(zoom: number, visible: LatLng | null = null) {
  state.zoom = zoom
  state.visible = visible
}

export function clickMap(lat: number, lng: number) {
  act(() => {
    state.click?.({ latlng: { lat, lng } })
  })
}

export function dragPinTo(lat: number, lng: number) {
  act(() => {
    state.dragEnd?.({ target: { getLatLng: () => ({ lat, lng }) } })
  })
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
  icon?: { options: { html?: string } }
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
      'data-icon-html': props.icon?.options.html,
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
      getSouthWest: () => ({ lat: state.bounds.south, lng: state.bounds.west }),
      getNorthEast: () => ({ lat: state.bounds.north, lng: state.bounds.east }),
    }),
  }
}

export function useMapEvents(handlers: { click?: ClickHandler; moveend?: MoveEndHandler }) {
  register({ click: handlers.click, moveEnd: handlers.moveend })
  return useMap()
}
