import * as api from './support/api.ts'
import { E2E_PASSWORD, expect, test } from './fixtures.ts'
import { insertAuthToken, waitForAuthToken } from './support/db.ts'

const NEW_PASSWORD = 'Nueva1234'

test('F7: forgot password, reset through the link, old session dies, new password works', async ({ page, users }) => {
  const session = await users.create('f7')

  await page.goto('/login')
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  await page.getByLabel('Email').fill(session.email)
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(page.getByRole('button', { name: 'Enviar enlace' })).toHaveCount(0)

  // The backend issues the token in the background after answering: wait for it,
  // otherwise it would invalidate the one seeded below.
  await waitForAuthToken(session.email, 'password_reset')
  const token = `e2e-reset-${Date.now()}`
  await insertAuthToken(session.email, 'password_reset', token)

  await page.goto(`/reset-password?token=${token}`)
  await expect(page).not.toHaveURL(/token=/)
  await page.getByLabel('Contraseña nueva').fill(NEW_PASSWORD)
  await page.getByLabel('Confirmar contraseña').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Tu contraseña se actualizó, iniciá sesión con la nueva')).toBeVisible()

  // Resetting bumps tokenVersion: the JWT issued before is dead.
  expect((await api.getMe(session.token)).status).toBe(401)

  await page.getByLabel('Email').fill(session.email)
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('Contraseña').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText(session.email)).toBeVisible()
})

test('F7: a used reset link is rejected with the generic message and offers a new one', async ({ page, users }) => {
  const session = await users.create('f7-reuse')
  const token = `e2e-reset-reuse-${Date.now()}`
  await insertAuthToken(session.email, 'password_reset', token)

  async function submitNewPassword() {
    await page.goto(`/reset-password?token=${token}`)
    await page.getByLabel('Contraseña nueva').fill(NEW_PASSWORD)
    await page.getByLabel('Confirmar contraseña').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
  }

  await submitNewPassword()
  await expect(page).toHaveURL(/\/login$/)

  await submitNewPassword()
  await expect(page.getByText('El enlace es inválido o expiró')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pedir un enlace nuevo' })).toBeVisible()
})
