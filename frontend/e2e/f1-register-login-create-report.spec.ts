import { E2E_PASSWORD, E2E_PHOTO, expect, test } from './fixtures.ts'
import { markEmailVerified } from './support/db.ts'

test('F1: a new user registers, logs in through the UI and creates a report (pending moderation)', async ({ page, users }) => {
  const email = users.email('f1')
  const title = `Perro perdido F1 ${Date.now()}`

  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(E2E_PASSWORD)
  await page.getByLabel('Confirmar contraseña').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Cuenta creada. Te enviamos un email para verificarla, revisá tu casilla e iniciá sesión')).toBeVisible()
  // Publishing a report needs a verified email; the mail-link journey has its own spec.
  await markEmailVerified(email)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText(email)).toBeVisible()

  await page.goto('/reports/new')
  await page.getByLabel('Título *').fill(title)
  await page.getByLabel('Descripción').fill('Collar rojo, responde a Toby')
  await page.locator('input[type=file]').setInputFiles(E2E_PHOTO)
  await expect(page.getByText('Foto subida correctamente')).toBeVisible()
  await page.getByRole('button', { name: /Usar mi ubicación actual/ }).click()
  await expect(page.getByText('Ubicación seleccionada')).toBeVisible()
  // Stubbed Nominatim answer replaces the raw coordinates.
  await expect(page.getByText('Ciudad E2E')).toBeVisible()
  await page.getByRole('button', { name: 'Crear Reporte' }).click()

  await expect(page).toHaveURL(/\/reports\/\d+$/)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  // With a photo the report is born pending until backend-ia moderates it.
  await expect(page.getByText('Estado: Pendiente')).toBeVisible()
  await expect(page.getByText('Ciudad E2E')).toBeVisible()
})
