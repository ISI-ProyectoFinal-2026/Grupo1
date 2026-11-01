import { E2E_PHOTO, expect, loginAs, test } from './fixtures.ts'
import { E2E_IMAGE_URL, E2E_LOW_QUALITY_IMAGE_URL, FRONTEND_URL } from './support/env.ts'

const QUALITY_MESSAGE =
  'La foto parece borrosa o movida. Probá subir una foto más nítida para que sea más fácil reconocer a tu mascota.'

// #212: a blurry photo only gets a warning; the report is still published.
test('F10: a blurry photo shows a non-blocking warning and the report can still be created', async ({ page, users }) => {
  const owner = await users.create('f10')
  const title = `Perro perdido F10 ${Date.now()}`
  let publicUrl = E2E_LOW_QUALITY_IMAGE_URL
  // Registered after the fixture's stub, so it wins: the AI stub flags this URL as low quality.
  await page.route('**/api/uploads/presign', (route) =>
    route.fulfill({ json: { uploadUrl: `${FRONTEND_URL}/e2e-r2-upload`, publicUrl, key: 'pets/e2e-photo.jpg' } }),
  )

  await loginAs(page, owner)
  await page.goto('/reports/new')
  await page.getByLabel('Título *').fill(title)
  await page.locator('input[type=file]').setInputFiles(E2E_PHOTO)

  const warning = page.getByRole('status').filter({ hasText: QUALITY_MESSAGE })
  await expect(warning).toBeVisible()
  await expect(page.getByText('Foto subida correctamente')).toBeVisible()

  // A sharper photo clears the warning.
  publicUrl = E2E_IMAGE_URL
  await page.locator('input[type=file]').setInputFiles(E2E_PHOTO)
  await expect(page.getByRole('img', { name: 'Foto subida' })).toHaveAttribute('src', E2E_IMAGE_URL)
  await expect(warning).toHaveCount(0)

  // Back to the blurry one: publishing stays enabled anyway.
  publicUrl = E2E_LOW_QUALITY_IMAGE_URL
  await page.locator('input[type=file]').setInputFiles(E2E_PHOTO)
  await expect(warning).toBeVisible()
  await page.getByRole('button', { name: /Usar mi ubicación actual/ }).click()
  await expect(page.getByText('Ubicación seleccionada')).toBeVisible()
  const submit = page.getByRole('button', { name: 'Crear Reporte' })
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect(page).toHaveURL(/\/reports\/\d+$/)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('Estado: Pendiente')).toBeVisible()
})
