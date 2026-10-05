/**
 * Test setup through the real backend API (not the UI): only the journey under
 * test goes through the browser, everything else is arranged here.
 */
import { BACKEND_URL, INTERNAL_API_KEY } from './env.ts'

export interface ApiUser {
  id: number
  email: string
  role: string
  [key: string]: unknown
}

export interface Session {
  token: string
  user: ApiUser
}

export interface ApiReport {
  id: number
  userId: number
  status: string
  title: string
  reportType: 'lost' | 'found'
}

async function call<T>(method: string, path: string, options: { token?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<{ status: number; body: T }> {
  const response = await fetch(`${BACKEND_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T }
}

async function expectStatus<T>(expected: number, label: string, promise: Promise<{ status: number; body: T }>): Promise<T> {
  const { status, body } = await promise
  if (status !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${status} ${JSON.stringify(body)}`)
  }
  return body
}

export function register(email: string, password: string): Promise<ApiUser> {
  return expectStatus(201, 'register', call<ApiUser>('POST', '/auth/register', { body: { email, password } }))
}

export function login(email: string, password: string): Promise<Session> {
  return expectStatus(200, 'login', call<Session>('POST', '/auth/login', { body: { email, password } }))
}

export interface NewReport {
  reportType: 'lost' | 'found'
  title: string
  description?: string
}

/** Without image: the backend publishes it right away, no AI involved. */
export function createReport(token: string, report: NewReport): Promise<ApiReport> {
  return expectStatus(
    201,
    'create report',
    call<ApiReport>('POST', '/reports', {
      token,
      body: { ...report, location: { lat: -34.6037, lng: -58.3816 }, locationAddress: 'Buenos Aires' },
    }),
  )
}

export function getReport(token: string, reportId: number): Promise<{ status: number; body: ApiReport }> {
  return call<ApiReport>('GET', `/reports/${reportId}`, { token })
}

export function listReportFlags(token: string): Promise<{ status: number; body: unknown }> {
  return call('GET', '/report-flags', { token })
}

/** What backend-ia calls after persisting a match (matching_service.py). */
export function notifyMatch(lostReportId: number, foundReportId: number, similarityScore: number): Promise<unknown> {
  return expectStatus(
    201,
    'internal match notification',
    call('POST', '/notifications/internal/match', {
      headers: { 'X-Internal-Key': INTERNAL_API_KEY },
      body: { lostReportId, foundReportId, similarityScore },
    }),
  )
}
