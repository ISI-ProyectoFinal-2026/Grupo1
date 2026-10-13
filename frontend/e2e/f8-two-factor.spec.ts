import type { Page } from '@playwright/test'
import * as api from './support/api.ts'
import { E2E_PASSWORD, expect, test, type E2EUsers } from './fixtures.ts'
import {
  ageTwoFactorReset,
  getTwoFactorState,
  insertAuthToken,
  markEmailVerified,
  resetTwoFactorLastStep,
  waitForAuthToken,
} from './support/db.ts'
import { totpAt, totpNow, wrongTotp } from './support/totp.ts'

const CHALLENGE_TITLE = 'Verificación en dos pasos'
const RESET_REQUEST_PATH = '/api/auth/2fa/reset/confirm'
const SECOND_FACTOR_PATH = '/api/auth/2fa/login'

/** token_hash is unique across the table, and parallel workers can share a millisecond. */
function uniqueToken(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function submitPassword(page: Page, email: string, password = E2E_PASSWORD): Promise<void> {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
}

async function reachChallenge(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await submitPassword(page, email)
  await expect(page.getByRole('heading', { name: CHALLENGE_TITLE })).toBeVisible()
}

/** Types the code and waits for the backend's answer, so five attempts can't overlap. */
async function submitSecondFactor(page: Page, label: string, code: string): Promise<number> {
  await page.getByLabel(label).fill(code)
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(SECOND_FACTOR_PATH)),
    page.getByRole('button', { name: 'Verificar' }).click(),
  ])
  return response.status()
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
}

/**
 * A verified user with 2FA already on, arranged through the API. Enabling stores
 * the accepted step (replay guard), so it is cleared: otherwise the code the
 * journey computes within the same 30 s would be rejected as a replay.
 */
async function createTwoFactorUser(users: E2EUsers, label: string) {
  const session = await users.create(label)
  const enabled = await api.enableTwoFactor(session.token)
  await resetTwoFactorLastStep(session.email)
  return { email: session.email, secret: enabled.secret, recoveryCodes: enabled.recoveryCodes }
}

test('F8: the TOTP helper matches the RFC 6238 SHA-1 vectors', () => {
  // ASCII "12345678901234567890" in base32, six digits (the RFC lists eight).
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
  const vectors: Array<[number, string]> = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ]
  for (const [seconds, expected] of vectors) {
    expect(totpAt(secret, Math.floor(seconds / 30))).toBe(expected)
  }
  expect(totpNow(secret, 59_000)).toBe('287082')

  // A "wrong" code must stay wrong for the whole acceptance window (+-1 step).
  const now = 1_700_000_000_000
  const step = Math.floor(now / 1000 / 30)
  const wrong = wrongTotp(secret, now)
  expect(wrong).toMatch(/^\d{6}$/)
  for (const offset of [-1, 0, 1]) {
    expect(wrong).not.toBe(totpAt(secret, step + offset))
  }
})

test('F8: enable 2FA, log in with the app code and a recovery code (single use), then disable it', async ({
  page,
  users,
}) => {
  const email = users.email('f8-life')
  await api.register(email, E2E_PASSWORD)
  await markEmailVerified(email)

  await page.goto('/login')
  await submitPassword(page, email)
  await expect(page).toHaveURL(/\/$/)

  // Enable from the security page, reached through the nav link.
  await page.getByRole('link', { name: `Seguridad de la cuenta: ${email}` }).click()
  await expect(page).toHaveURL(/\/account\/security$/)
  await page.getByRole('button', { name: 'Activar verificación en dos pasos' }).click()

  const secretText = page
    .getByText('Si no podés escanearlo, ingresá esta clave a mano:')
    .locator('xpath=following-sibling::p[1]')
  await expect(secretText).toBeVisible()
  const secret = (await secretText.innerText()).trim()
  expect(secret).toMatch(/^[A-Z2-7]{32}$/)
  await expect(
    page.getByRole('img', { name: 'Código QR para tu app de autenticación' })
  ).toBeVisible()

  await page.getByLabel('Código de 6 dígitos').fill(totpNow(secret))
  await page.getByRole('button', { name: 'Confirmar y activar' }).click()

  // The recovery codes are shown once, and the modal can't be closed until the
  // user confirms having saved them.
  const dialog = page.getByRole('dialog', { name: 'Tus códigos de recuperación' })
  await expect(dialog).toBeVisible()
  const recoveryCodes = (await dialog.getByRole('listitem').allInnerTexts()).map((code) =>
    code.trim()
  )
  expect(recoveryCodes).toHaveLength(10)
  expect(new Set(recoveryCodes).size).toBe(10)
  await expect(dialog.getByRole('button', { name: 'Cerrar' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Guardé mis códigos').check()
  await dialog.getByRole('button', { name: 'Cerrar' }).click()
  await expect(dialog).toHaveCount(0)

  await expect(page.getByText('La verificación en dos pasos está activada.')).toBeVisible()
  await expect(page.getByText('Te quedan 10 códigos de recuperación.')).toBeVisible()
  expect((await getTwoFactorState(email)).enabled).toBe(true)

  // Log in with the app code. Enabling recorded its step: clear it, or the same
  // code (still valid within this 30 s) would be rejected as a replay.
  await logout(page)
  await resetTwoFactorLastStep(email)
  await submitPassword(page, email)
  await expect(page.getByRole('heading', { name: CHALLENGE_TITLE })).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Código de verificación').fill(totpNow(secret))
  await page.getByRole('button', { name: 'Verificar' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText(email)).toBeVisible()

  // Log in with a recovery code.
  await logout(page)
  await page.goto('/login')
  await submitPassword(page, email)
  await page.getByRole('button', { name: 'Usar un código de recuperación' }).click()
  await page.getByLabel('Código de recuperación').fill(recoveryCodes[0])
  await page.getByRole('button', { name: 'Verificar' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText(email)).toBeVisible()

  // The same code a second time is rejected, and the challenge stays usable.
  await logout(page)
  await page.goto('/login')
  await submitPassword(page, email)
  await page.getByRole('button', { name: 'Usar un código de recuperación' }).click()
  expect(await submitSecondFactor(page, 'Código de recuperación', recoveryCodes[0])).toBe(400)
  await expect(page.getByText('El código es inválido o expiró')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)

  // Back in with the second recovery code, the count dropped to 8.
  await page.getByLabel('Código de recuperación').fill(recoveryCodes[1])
  await page.getByRole('button', { name: 'Verificar' }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/account/security')
  await expect(page.getByText('Te quedan 8 códigos de recuperación.')).toBeVisible()

  // Disable with password + app code (clear the step recorded by the TOTP login).
  await resetTwoFactorLastStep(email)
  const disable = page.getByRole('region', { name: 'Desactivar la verificación en dos pasos' })
  await disable.getByLabel('Contraseña').fill(E2E_PASSWORD)
  await disable.getByLabel('Código de tu app').fill(totpNow(secret))
  await disable.getByRole('button', { name: 'Desactivar verificación en dos pasos' }).click()

  await expect(
    page.getByRole('button', { name: 'Activar verificación en dos pasos' })
  ).toBeVisible()
  await expect(page.getByText('La verificación en dos pasos está activada.')).toHaveCount(0)
  expect(await getTwoFactorState(email)).toMatchObject({
    enabled: false,
    hasSecret: false,
    unusedRecoveryCodes: 0,
  })

  // Password alone is enough again.
  const session = await api.login(email, E2E_PASSWORD)
  expect(session.user.twoFactorEnabled).toBe(false)
})

test('F8: five wrong codes lock the second step and keep the lost-access entry', async ({
  page,
  users,
}) => {
  const { email, secret } = await createTwoFactorUser(users, 'f8-lock')

  await reachChallenge(page, email)
  for (let attempt = 1; attempt <= 4; attempt++) {
    expect(await submitSecondFactor(page, 'Código de verificación', wrongTotp(secret))).toBe(400)
    await expect(page.getByText('El código es inválido o expiró')).toBeVisible()
  }
  expect(await submitSecondFactor(page, 'Código de verificación', wrongTotp(secret))).toBe(429)

  const waitMessage = page.getByText(/Demasiados intentos fallidos\. Probá de nuevo en 15 minutos/)
  await expect(waitMessage).toBeVisible()
  expect((await getTwoFactorState(email)).locked).toBe(true)
  await expect(page).toHaveURL(/\/login$/)

  // Locked means locked: not even the right code gets in.
  expect(await submitSecondFactor(page, 'Código de verificación', totpNow(secret))).toBe(429)
  await expect(waitMessage).toBeVisible()
  await expect(page.getByRole('heading', { name: CHALLENGE_TITLE })).toBeVisible()

  // Lost access still works while locked (it only needs the password).
  await page.getByRole('button', { name: 'Perdí el acceso a mi autenticador' }).click()
  await expect(page.getByRole('heading', { name: 'Recuperar el acceso' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar email de confirmación' })).toBeVisible()
})

test('F8: lost access starts a delayed reset that completes after 72 h with the password alone', async ({
  page,
  users,
}) => {
  const { email } = await createTwoFactorUser(users, 'f8-reset')

  // Lost access: password only, a confirmation email goes out.
  await reachChallenge(page, email)
  await page.getByRole('button', { name: 'Perdí el acceso a mi autenticador' }).click()
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Enviar email de confirmación' }).click()
  await expect(page.getByRole('button', { name: 'Enviar email de confirmación' })).toHaveCount(0)
  await expect(page.getByRole('status')).toBeVisible()
  await waitForAuthToken(email, 'two_factor_reset')
  expect((await getTwoFactorState(email)).resetPending).toBe(false)

  // The real link only travels by mail: seed a token we know, after the one the
  // backend issued (issuing invalidates earlier unused ones).
  const token = uniqueToken('e2e-2fa-reset')
  await insertAuthToken(email, 'two_factor_reset', token)

  // Opening the link must not start anything: a mail scanner that runs JS would.
  const confirmRequests: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes(RESET_REQUEST_PATH)) {
      confirmRequests.push(request.url())
    }
  })
  await page.goto(`/two-factor/reset/confirm?token=${token}`)
  await expect(page).not.toHaveURL(/token=/)
  const confirm = page.getByRole('button', { name: 'Confirmar reinicio' })
  await expect(confirm).toBeVisible()
  expect(confirmRequests).toHaveLength(0)
  expect((await getTwoFactorState(email)).resetPending).toBe(false)

  await confirm.click()
  await expect(page.getByRole('heading', { name: 'Reinicio en curso' })).toBeVisible()
  expect(confirmRequests).toHaveLength(1)
  expect((await getTwoFactorState(email)).resetPending).toBe(true)

  // Before the 72 h are over, the password still leads to the second step, and
  // the challenge says a reset is in progress.
  await page.goto('/login')
  await submitPassword(page, email)
  await expect(page.getByRole('heading', { name: CHALLENGE_TITLE })).toBeVisible()
  await expect(page.getByRole('status')).toContainText(
    'Hay un reinicio de la verificación en dos pasos en curso'
  )
  await page.getByRole('button', { name: 'Volver al inicio de sesión' }).click()

  // 72 h later the password alone completes the reset and logs in.
  await ageTwoFactorReset(email)
  await submitPassword(page, email)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText(email)).toBeVisible()
  expect(await getTwoFactorState(email)).toMatchObject({
    enabled: false,
    hasSecret: false,
    resetPending: false,
    unusedRecoveryCodes: 0,
  })

  await page.goto('/account/security')
  await expect(
    page.getByRole('button', { name: 'Activar verificación en dos pasos' })
  ).toBeVisible()
})

test('F8: the cancel link stops a pending reset and 2FA keeps being required', async ({
  page,
  users,
}) => {
  const { email } = await createTwoFactorUser(users, 'f8-cancel')

  // Arrange a pending reset through the API: request, then confirm with a known token.
  const challenge = await api.loginStep(email, E2E_PASSWORD)
  if (!('twoFactorToken' in challenge)) throw new Error('expected a second-factor challenge')
  await api.requestTwoFactorReset(challenge.twoFactorToken, E2E_PASSWORD)
  await waitForAuthToken(email, 'two_factor_reset')
  const confirmToken = uniqueToken('e2e-2fa-confirm')
  await insertAuthToken(email, 'two_factor_reset', confirmToken)
  await api.confirmTwoFactorReset(confirmToken)
  expect((await getTwoFactorState(email)).resetPending).toBe(true)

  // Confirming issued its own cancel token: seed ours after it.
  const cancelToken = uniqueToken('e2e-2fa-cancel')
  await insertAuthToken(email, 'two_factor_reset_cancel', cancelToken)

  // The cancel page acts on load and never leaves the token in the URL.
  await page.goto(`/two-factor/reset/cancel?token=${cancelToken}`)
  await expect(page.getByRole('heading', { name: 'Reinicio cancelado' })).toBeVisible()
  await expect(page).not.toHaveURL(/token=/)
  expect((await getTwoFactorState(email)).resetPending).toBe(false)

  // A used link says nothing more than "invalid".
  await page.goto(`/two-factor/reset/cancel?token=${cancelToken}`)
  await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible()
  await expect(page.getByText('El enlace es inválido o expiró')).toBeVisible()

  // 2FA is still on: the password leads to the second step and the challenge no
  // longer mentions a reset.
  await reachChallenge(page, email)
  await expect(
    page.getByText('Hay un reinicio de la verificación en dos pasos en curso')
  ).toHaveCount(0)
  expect((await getTwoFactorState(email)).enabled).toBe(true)
  await expect(page).toHaveURL(/\/login$/)
})
