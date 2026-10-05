import { test as base, type Page } from '@playwright/test'
import * as api from './support/api.ts'
import { closeDb, deleteUsersByEmail } from './support/db.ts'
import { E2E_EMAIL_DOMAIN, E2E_EMAIL_PREFIX, E2E_PASSWORD } from './support/env.ts'

/** zustand persist key of frontend/src/stores/auth.store.ts */
const AUTH_STORAGE_KEY = 'patitas-auth'

export interface E2EUsers {
  /** Unique, tracked email: whatever ends up registered with it is deleted after the test. */
  email(label: string): string
  /** Registers + logs in through the API. */
  create(label: string): Promise<api.Session & { email: string }>
  /** Logs in again (e.g. after a role change: the role travels in the login response). */
  relogin(email: string): Promise<api.Session>
}

interface Fixtures {
  users: E2EUsers
}

/**
 * Starts the page already logged in, as if the user had gone through the login
 * form (only F1 exercises the real form). Runs before any app script, on every
 * navigation of this page.
 */
export async function loginAs(page: Page, session: api.Session): Promise<void> {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [AUTH_STORAGE_KEY, JSON.stringify({ state: { token: session.token, user: session.user }, version: 0 })],
  )
}

/** Fakes the third-party calls the app makes from the browser. */
export async function stubExternalServices(page: Page): Promise<void> {
  // LocationPicker reverse-geocodes the coordinates with Nominatim.
  await page.route('https://nominatim.openstreetmap.org/**', (route) =>
    route.fulfill({ json: { address: { city: 'Ciudad E2E' } } }),
  )
  // Map tiles (FeedPage/MapView): never hit the public OSM servers from tests.
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 204 }))
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await stubExternalServices(page)
    await use(page)
  },

  users: async ({}, use, testInfo) => {
    const emails: string[] = []
    const users: E2EUsers = {
      email(label) {
        const unique = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`
        const email = `${E2E_EMAIL_PREFIX}${label}-${unique}@${E2E_EMAIL_DOMAIN}`
        emails.push(email)
        return email
      },
      async create(label) {
        const email = users.email(label)
        await api.register(email, E2E_PASSWORD)
        return { ...(await api.login(email, E2E_PASSWORD)), email }
      },
      relogin: (email) => api.login(email, E2E_PASSWORD),
    }

    await use(users)

    await deleteUsersByEmail(emails)
    await closeDb()
  },
})

export { expect } from '@playwright/test'
export { E2E_PASSWORD }
