import { expect, loginAs, test } from './fixtures.ts'
import * as api from './support/api.ts'

test('F11: a free business upgrades to Premium from the dashboard and then renews', async ({ page, users }) => {
  const owner = await users.create('f11-owner')
  await api.createBusiness(owner.token, `Veterinaria F11 ${Date.now()}`)

  await loginAs(page, owner)
  await page.goto('/businesses/dashboard')
  await expect(page.getByTestId('current-plan')).toHaveText('Gratis')

  await page.getByRole('link', { name: 'Pasar a Premium' }).click()
  await expect(page).toHaveURL(/\/businesses\/plan$/)
  await expect(page.getByText('USD 30', { exact: true })).toBeVisible()
  await expect(page.getByText('USD 300', { exact: true })).toBeVisible()
  await expect(page.getByText(/Ahorrás USD 60/)).toBeVisible()
  await expect(page.getByText(/Pago simulado/)).toBeVisible()

  await page.getByRole('radio', { name: /Anual/ }).check()
  await page.getByRole('button', { name: 'Pasar a Premium' }).click()

  await expect(page.getByRole('status')).toContainText('Listo, tu plan Premium vence el')
  await expect(page.getByTestId('current-plan')).toHaveText('Premium')
  await expect(page.getByRole('button', { name: 'Renovar Premium' })).toBeVisible()
  await expect(page.getByText(/se suma a tu vencimiento actual/)).toBeVisible()

  await page.getByRole('link', { name: 'Volver al panel' }).click()
  await expect(page.getByTestId('current-plan')).toHaveText('Premium')
  await expect(page.getByText(/^Vence: /)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Renovar' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pasar a Premium' })).toHaveCount(0)

  // persisted on the backend, not just in the client cache
  await page.reload()
  await expect(page.getByTestId('current-plan')).toHaveText('Premium')
})
