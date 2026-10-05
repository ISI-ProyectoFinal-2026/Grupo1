import { expect, loginAs, test } from './fixtures.ts'

test('F5: invalid credentials show an error and keep the user on the login page', async ({ page, users }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(users.email('f5-unknown'))
  await page.getByLabel('Contraseña').fill('WrongPass123')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page.getByText('Credenciales inválidas')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('F5: the create-report form reports validation errors instead of submitting', async ({ page, users }) => {
  const user = await users.create('f5-form')

  await loginAs(page, user)
  await page.goto('/reports/new')
  await page.getByLabel('Título *').fill('Gato')
  await page.getByRole('button', { name: 'Crear Reporte' }).click()

  await expect(page.getByText('Por favor, corregí los errores del formulario')).toBeVisible()
  await expect(page.getByText('Mínimo 5 caracteres')).toBeVisible()
  await expect(page.getByText('Indicá la ubicación con el botón de arriba')).toBeVisible()
  await expect(page).toHaveURL(/\/reports\/new$/)
})

test('F5: an unknown route shows the 404 page', async ({ page }) => {
  await page.goto('/esta-ruta-no-existe')

  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible()
})
