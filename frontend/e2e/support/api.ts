/**
 * Test setup through the real backend API (not the UI): only the journey under
 * test goes through the browser, everything else is arranged here.
 */
import { publishReport } from './db.ts'
import { BACKEND_URL, E2E_IMAGE_URL, INTERNAL_API_KEY } from './env.ts'
import { totpNow } from './totp.ts'

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

/** What a password login answers when the account has 2FA: no session yet. */
interface TwoFactorChallenge {
  twoFactorRequired: true
  twoFactorToken: string
  resetEffectiveAt?: string
}

interface ApiReport {
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

/** First step of a login: a session, or the challenge when the account has 2FA. */
export function loginStep(email: string, password: string): Promise<Session | TwoFactorChallenge> {
  return expectStatus(200, 'login', call<Session | TwoFactorChallenge>('POST', '/auth/login', { body: { email, password } }))
}

/** Login for accounts without 2FA (every f1-f7 user): a challenge here is a test bug. */
export async function login(email: string, password: string): Promise<Session> {
  const response = await loginStep(email, password)
  if ('twoFactorToken' in response) {
    throw new Error(`login: ${email} has 2FA on, use loginStep and complete the second factor`)
  }
  return response
}

interface EnabledTwoFactor {
  /** The fresh session: enabling bumps tokenVersion, so the one used to enable is dead. */
  session: Session
  secret: string
  recoveryCodes: string[]
}

/** setup + enable with a code computed from the secret, as the authenticator app would. */
export async function enableTwoFactor(token: string): Promise<EnabledTwoFactor> {
  const { secret } = await expectStatus(200, '2fa setup', call<{ secret: string }>('POST', '/auth/2fa/setup', { token }))
  const enabled = await expectStatus(
    200,
    '2fa enable',
    call<Session & { recoveryCodes: string[] }>('POST', '/auth/2fa/enable', { token, body: { code: totpNow(secret) } }),
  )
  return { session: { token: enabled.token, user: enabled.user }, secret, recoveryCodes: enabled.recoveryCodes }
}

export function requestTwoFactorReset(twoFactorToken: string, password: string): Promise<unknown> {
  return expectStatus(200, '2fa reset request', call('POST', '/auth/2fa/reset/request', { body: { twoFactorToken, password } }))
}

export function confirmTwoFactorReset(token: string): Promise<unknown> {
  return expectStatus(200, '2fa reset confirm', call('POST', '/auth/2fa/reset/confirm', { body: { token } }))
}

/** Raw status, to assert that a stale JWT is rejected. */
export function getMe(token: string): Promise<{ status: number; body: unknown }> {
  return call('GET', '/auth/me', { token })
}

interface NewReport {
  reportType: 'lost' | 'found'
  title: string
  description?: string
  location?: { lat: number; lng: number }
}

/**
 * The photo is mandatory, so the backend creates the report as pending and the
 * AI stub never publishes it (409): publish it straight in the DB instead.
 */
export async function createPublishedReport(token: string, report: NewReport): Promise<ApiReport> {
  const created = await expectStatus(
    201,
    'create report',
    call<ApiReport>('POST', '/reports', {
      token,
      body: {
        imageUrl: E2E_IMAGE_URL,
        location: { lat: -34.6037, lng: -58.3816 },
        locationAddress: 'Buenos Aires',
        ...report,
      },
    }),
  )
  await publishReport(created.id)
  return { ...created, status: 'published' }
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
