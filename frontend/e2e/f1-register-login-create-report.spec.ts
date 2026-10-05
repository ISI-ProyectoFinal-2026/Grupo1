import { E2E_PASSWORD, expect, test } from './fixtures.ts'

test('F1: a new user registers, logs in through the UI and publishes a report', async ({ page, users }) => {
  const email = users.email('f1')
  const title = `Perro perdido F1 ${Date.now()}`

  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(E2E_PASSWORD)
  await page.getByLabel('Confirmar contraseña').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Cuenta creada, iniciá sesión')).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText(email)).toBeVisible()

  await page.goto('/reports/new')
  await page.getByLabel('Título *').fill(title)
  await page.getByLabel('Descripción').fill('Collar rojo, responde a Toby')
  await page.getByRole('button', { name: /Usar mi ubicación actual/ }).click()
  await expect(page.getByText('Ubicación seleccionada')).toBeVisible()
  // Stubbed Nominatim answer replaces the raw coordinates.
  await expect(page.getByText('Ciudad E2E')).toBeVisible()
  await page.getByRole('button', { name: 'Crear Reporte' }).click()

  await expect(page).toHaveURL(/\/reports\/\d+$/)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('Estado: published')).toBeVisible()
  await expect(page.getByText('Ciudad E2E')).toBeVisible()
})
