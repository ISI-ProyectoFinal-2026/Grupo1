import { afterEach, describe, expect, it, vi } from 'vitest'
import { todayInArgentina } from '@/lib/format'

// la app usa solo la hora de Argentina (#259)
describe('todayInArgentina', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('devuelve el dia de Argentina aunque en UTC ya sea el siguiente', () => {
    vi.stubEnv('TZ', 'UTC')
    const ahora = new Date('2026-11-03T02:30:00Z')

    expect(ahora.getDate()).toBe(3)
    expect(todayInArgentina(ahora)).toBe('2026-11-02')
  })

  it('devuelve el dia de Argentina aunque el navegador este en otra zona', () => {
    vi.stubEnv('TZ', 'Asia/Tokyo')

    expect(todayInArgentina(new Date('2026-11-02T20:00:00Z'))).toBe('2026-11-02')
  })

  it('cambia de dia a la medianoche de Argentina', () => {
    expect(todayInArgentina(new Date('2026-11-03T02:59:59Z'))).toBe('2026-11-02')
    expect(todayInArgentina(new Date('2026-11-03T03:00:00Z'))).toBe('2026-11-03')
  })
})
