import { describe, expect, it } from 'vitest'
import {
  formatDateTime,
  formatLongDate,
  formatLongDateTime,
  formatShortDate,
  formatShortDateTime,
  formatTime,
} from '@/lib/format'

// fecha local, así el test no depende de la zona horaria de la máquina
const fecha = new Date(2026, 10, 5, 9, 7)
const iso = fecha.toISOString()

// cada formato reemplaza a uno que estaba definido en una pantalla (#351):
// se compara contra la misma llamada que se usaba ahí para no cambiar lo que se ve
describe('formatos de fecha centralizados (#351)', () => {
  it('formatLongDate: fecha larga del detalle de reporte', () => {
    expect(formatLongDate(iso)).toBe(fecha.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' }))
    expect(formatLongDate(iso)).toBe('5 de noviembre de 2026')
  })

  it('formatShortDate: día y mes abreviado de la lista de chats', () => {
    expect(formatShortDate(iso)).toBe(fecha.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' }))
    expect(formatShortDate(iso)).toMatch(/^5 nov/)
  })

  it('formatTime: hora de un mensaje', () => {
    expect(formatTime(iso)).toBe(fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))
    expect(formatTime(iso)).toMatch(/09:07/)
  })

  it('formatShortDateTime: día, mes y hora de notificaciones y denuncias', () => {
    const anterior = new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(fecha)
    expect(formatShortDateTime(iso)).toBe(anterior)
    expect(formatShortDateTime(iso)).toMatch(/5\/11.*09:07/)
  })

  it('formatDateTime: fecha completa y hora del registro de roles', () => {
    const anterior = new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(fecha)
    expect(formatDateTime(iso)).toBe(anterior)
    expect(formatDateTime(iso)).toMatch(/05\/11\/2026.*09:07/)
  })

  it('formatLongDateTime: fecha larga y hora del reinicio de 2FA', () => {
    expect(formatLongDateTime(iso)).toBe(fecha.toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' }))
    expect(formatLongDateTime(iso)).toMatch(/5 de noviembre de 2026.*9:07/)
  })
})
