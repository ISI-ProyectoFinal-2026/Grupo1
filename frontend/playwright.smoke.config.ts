import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke test of the demo (#371) against the running docker compose stack with
 * the real backend-ia. Starts no servers: run `docker compose up -d` and
 * `seed-demo` first (docs/demo/guion.md).
 */
export default defineConfig({
  testDir: './e2e/smoke',
  testMatch: '**/*.smoke.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-AR',
    // seed reports are in San Rafael and matching only looks within 5 km
    geolocation: { latitude: -34.6205, longitude: -68.327 },
    permissions: ['geolocation'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
