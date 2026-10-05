import { defineConfig, devices } from '@playwright/test'
import {
  AI_STUB_PORT,
  AI_STUB_URL,
  BACKEND_URL,
  DATABASE_URL,
  FRONTEND_PORT,
  FRONTEND_URL,
  INTERNAL_API_KEY,
  JWT_SECRET,
} from './e2e/support/env.ts'

/**
 * Browser E2E (issue #39). Boots the whole stack except backend-ia, which is
 * replaced by a tiny HTTP stub. Postgres must already be running with the
 * migrations applied (docker compose up -d + prisma migrate deploy).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-AR',
    // LocationPicker only uses navigator.geolocation.
    geolocation: { latitude: -34.6037, longitude: -58.3816 },
    permissions: ['geolocation'],
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'ai-stub',
      command: 'node e2e/support/ai-stub-server.ts',
      url: `${AI_STUB_URL}/health`,
      env: { AI_STUB_PORT: String(AI_STUB_PORT), INTERNAL_API_KEY },
      reuseExistingServer: !process.env.CI,
    },
    {
      name: 'backend',
      command: 'npm run dev',
      cwd: '../backend',
      // Public endpoint: answers 200 once Express and Prisma are up.
      url: `${BACKEND_URL}/api/reports`,
      timeout: 120_000,
      // dotenv never overrides variables that are already set, so these win
      // over backend/.env while the rest of it (R2, etc.) still loads.
      env: {
        PORT: '3001',
        // Skips the auth/upload/flyer rate limiters.
        NODE_ENV: 'test',
        DATABASE_URL,
        JWT_SECRET,
        INTERNAL_API_KEY,
        AI_SERVICE_URL: AI_STUB_URL,
        TRUST_PROXY: '1',
      },
      reuseExistingServer: !process.env.CI,
    },
    {
      name: 'frontend',
      // Production bundle served by `vite preview`, which proxies /api and
      // /socket.io to localhost:3001 like `vite dev` (vite.config.ts).
      command: `npx vite build && npx vite preview --port ${FRONTEND_PORT} --strictPort`,
      url: FRONTEND_URL,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
