import { describe, expect, it } from 'vitest'
import { getSafeRedirect, postLoginPath } from '@/lib/redirect'

describe('getSafeRedirect', () => {
  it('arma la ruta interna con search y hash', () => {
    expect(getSafeRedirect({ from: { pathname: '/reports/5', search: '?vista=mapa', hash: '#flyer' } })).toBe(
      '/reports/5?vista=mapa#flyer'
    )
  })

  it('acepta una ruta sin search ni hash', () => {
    expect(getSafeRedirect({ from: { pathname: '/chats/3' } })).toBe('/chats/3')
  })

  it.each([
    ['sin state', null],
    ['state sin from', { registered: true }],
    ['from no es objeto', { from: '/reports' }],
    ['pathname no es texto', { from: { pathname: 5 } }],
  ])('devuelve null %s', (_caso, state) => {
    expect(getSafeRedirect(state)).toBeNull()
  })

  // evita redirecciones abiertas: solo rutas del propio sitio
  it.each([
    'https://malicioso.test/robo',
    '//malicioso.test',
    '/\\malicioso.test',
    'javascript:alert(1)',
    'reports/5',
    '',
  ])('rechaza %s', (pathname) => {
    expect(getSafeRedirect({ from: { pathname } })).toBeNull()
  })

  it('rechaza un search o hash que no empiezan como tales', () => {
    expect(getSafeRedirect({ from: { pathname: '/reports', search: '//x' } })).toBeNull()
    expect(getSafeRedirect({ from: { pathname: '/reports', hash: 'x' } })).toBeNull()
  })

  it.each(['/login', '/register', '/login/', '/register/'])('no vuelve a %s', (pathname) => {
    expect(getSafeRedirect({ from: { pathname } })).toBeNull()
  })
})

describe('postLoginPath', () => {
  it('usa el destino guardado si es seguro', () => {
    expect(postLoginPath({ from: { pathname: '/reports/5' } })).toBe('/reports/5')
  })

  it('cae al inicio si no hay destino o no es seguro', () => {
    expect(postLoginPath(null)).toBe('/')
    expect(postLoginPath({ from: { pathname: '//malicioso.test' } })).toBe('/')
  })
})
