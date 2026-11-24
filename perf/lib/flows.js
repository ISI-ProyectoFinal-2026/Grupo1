import { sleep } from 'k6'
import { R2_PUBLIC_URL } from './config.js'
import { checkStep, get, json, post } from './http.js'
import { matchingDuration } from './metrics.js'
import { randomReportId, userForVu } from './users.js'
import { think } from './think.js'

// login: devuelve el token (o null si falló)
export function login(user = userForVu()) {
  const res = post('login', '/api/auth/login', { email: user.email, password: user.password })
  const ok = checkStep(res, 'login', 200, (b) => typeof b.token === 'string' && b.token.length > 0)
  return ok ? json(res).token : null
}

// flujo 1: visitante navega el feed y abre reportes
export function browseFeed(thinkRange) {
  const feed = get('feed', '/api/reports')
  checkStep(feed, 'feed', 200, (b) => Array.isArray(b) && b.length > 0)
  const list = json(feed)
  const opens = 2 + Math.floor(Math.random() * 2)
  for (let i = 0; i < opens; i++) {
    think(...thinkRange)
    const id = Array.isArray(list) && list.length ? list[Math.floor(Math.random() * list.length)].id : randomReportId()
    const detail = get('detail', `/api/reports/${id}`)
    checkStep(detail, 'detail', 200, (b) => b.id === id && b.location !== undefined)
  }
}

// flujo 2: login, mis reportes y coincidencias
export function myReportsAndMatches(thinkRange) {
  const token = login()
  if (!token) return
  think(...thinkRange)
  const mine = get('mine', '/api/reports/mine', token)
  checkStep(mine, 'mine', 200, (b) => Array.isArray(b))
  think(...thinkRange)
  const matches = get('matches', `/api/reports/${randomReportId()}/matches`, token)
  checkStep(matches, 'matches', 200, (b) => Array.isArray(b))
}

// flujo 3: crear reporte y consultar hasta que salga de pending
export function createReport(thinkRange, { pollAttempts = 3, pollIntervalS = 1 } = {}) {
  const token = login()
  if (!token) return
  think(...thinkRange)
  const body = {
    reportType: Math.random() < 0.5 ? 'lost' : 'found',
    title: `Perf VU${__VU} iter${__ITER}`,
    description: 'Reporte creado por k6',
    imageUrl: `${R2_PUBLIC_URL}/pets/perf-created.jpg`,
    location: { lat: -34.6 + Math.random() * 0.1, lng: -58.4 + Math.random() * 0.1 },
  }
  const startedAt = Date.now()
  const created = post('create', '/api/reports', body, token)
  const ok = checkStep(created, 'create', 201, (b) => Number.isInteger(b.id) && typeof b.status === 'string')
  if (!ok) return
  const id = json(created).id
  // polling acotado: sin Backend IA real el reporte sigue pending
  for (let i = 0; i < pollAttempts; i++) {
    sleep(pollIntervalS)
    const res = get('detail', `/api/reports/${id}`, token)
    checkStep(res, 'poll', 200, (b) => b.id === id)
    const status = json(res)?.status
    if (status && status !== 'pending') {
      matchingDuration.add(Date.now() - startedAt)
      return
    }
  }
}

// flujo 5: login y navegación general
export function loginAndMe(thinkRange) {
  const token = login()
  if (!token) return
  think(...thinkRange)
  const me = get('me', '/api/auth/me', token)
  checkStep(me, 'me', 200, (b) => typeof b.email === 'string' || (b.user && typeof b.user.email === 'string'))
}
