import * as api from './support/api.ts'
import { E2E_PASSWORD, expect, test } from './fixtures.ts'
import { ageLatestToken, insertAuthToken } from './support/db.ts'

const INVALID_LINK = 'El enlace es inválido o expiró'

test('F6: an unverified user is blocked inline, resends the email and verifies through the link', async ({
  page,
  users,
}) => {
  const email = users.email('f6')
  const title = `Perro perdido F6 ${Date.now()}`

  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(E2E_PASSWORD)
  await page.getByLabel('Confirmar contraseña').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/$/)

  // The banner nags, but nothing is disabled: the 403 shows up where the user acted.
  const banner = page.getByRole('region', { name: 'Verificación de email' })
  await expect(banner).toBeVisible()
  await expect(banner).toContainText(email)

  await page.goto('/reports/new')
  await page.getByLabel('Título *').fill(title)
  await page.getByRole('button', { name: /Usar mi ubicación actual/ }).click()
  await expect(page.getByText('Ciudad E2E')).toBeVisible()
  await page.getByRole('button', { name: 'Crear Reporte' }).click()
  await expect(page.getByRole('alert')).toContainText('Verificá tu email para poder hacer esto')
  await expect(page).toHaveURL(/\/reports\/new$/)
  await expect(page.getByLabel('Título *')).toHaveValue(title)

  // The register email already started the 60s cooldown: age it, then resend.
  await ageLatestToken(email, 'email_verification')
  await banner.getByRole('button', { name: 'Reenviar email de verificación' }).click()
  await expect(banner.getByText('Te mandamos un nuevo email')).toBeVisible()

  // The resend invalidated the register token: only now seed the one we know.
  const token = `e2e-verify-${Date.now()}`
  await insertAuthToken(email, 'email_verification', token)

  await page.goto(`/verify-email?token=${token}`)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('region', { name: 'Verificación de email' })).toHaveCount(0)

  await page.goto('/reports/new')
  await page.getByLabel('Título *').fill(title)
  await page.getByRole('button', { name: /Usar mi ubicación actual/ }).click()
  await expect(page.getByText('Ciudad E2E')).toBeVisible()
  await page.getByRole('button', { name: 'Crear Reporte' }).click()
  await expect(page).toHaveURL(/\/reports\/\d+$/)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  // A used link says nothing about why it fails, and the token is not left in the URL.
  await page.goto(`/verify-email?token=${token}`)
  await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible()
  await expect(page.getByText(INVALID_LINK)).toBeVisible()
  await expect(page).not.toHaveURL(/token=/)
})

test('F6: the link opened without a session verifies and sends the user to log in', async ({ page, users }) => {
  const email = users.email('f6-out')
  await api.register(email, E2E_PASSWORD)
  const token = `e2e-verify-out-${Date.now()}`
  await insertAuthToken(email, 'email_verification', token)

  await page.goto(`/verify-email?token=${token}`)
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Tu email quedó verificado, iniciá sesión')).toBeVisible()

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText(email)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Verificación de email' })).toHaveCount(0)
})

test('F6: a link that was never issued is rejected with the generic message', async ({ page }) => {
  await page.goto('/verify-email?token=e2e-never-issued')
  await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible()
  await expect(page.getByText(INVALID_LINK)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Iniciá sesión' })).toBeVisible()
})
