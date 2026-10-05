/**
 * Single source of truth for the E2E stack wiring. Both playwright.config.ts
 * (which boots the servers) and the helpers (which talk to them) read from here,
 * so the backend and the DB helper can never point at different databases.
 *
 * Every value can be overridden through the environment (CI does it); the
 * defaults match the local docker-compose setup.
 */

// Vite's proxy (vite.config.ts) hardcodes localhost:3001 as the backend, so
// the backend port is not configurable here on purpose.
export const BACKEND_PORT = 3001
export const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 4173)
export const AI_STUB_PORT = Number(process.env.E2E_AI_STUB_PORT ?? 8765)

export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`
export const AI_STUB_URL = `http://localhost:${AI_STUB_PORT}`

// Local default = docker-compose.yml (host port 5433). The backend is started
// with this same DATABASE_URL, overriding whatever backend/.env says.
export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://patitas:patitas@localhost:5433/patitas'

export const JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-ui-jwt-secret-not-for-production'
export const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? 'e2e-ui-internal-key'

// Every user created by the browser suite has this prefix, so leftovers from
// an aborted run can be purged by pattern (see global-setup.ts).
export const E2E_EMAIL_PREFIX = 'e2e-ui-'
export const E2E_EMAIL_DOMAIN = 'example.com'

// Satisfies the backend registerSchema (upper, lower, digit, 8+ chars).
export const E2E_PASSWORD = 'Patitas123'
