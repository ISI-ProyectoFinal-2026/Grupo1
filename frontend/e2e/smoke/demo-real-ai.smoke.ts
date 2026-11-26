import path from 'node:path'
import { expect, test } from '@playwright/test'
import { dismissLocationConsent } from '../fixtures.ts'

// CP-001 (docs/qa/catalogo-casos-prueba.md): main journey with the real backend-ia
const SMOKE_EMAIL = process.env.SMOKE_EMAIL ?? 'diego@demo.patitas.local'
const SEEDED_LOST_TITLE = 'Se perdió Toby, perro de agua negro'
const PHOTO = path.resolve(import.meta.dirname, '../../../backend/demo-assets/toby-smoke.jpg')

let createdReportId: string | undefined
let token: string | undefined

test.afterAll(async ({ request }) => {
  if (!createdReportId || !token) return
  const response = await request.delete(`/api/reports/${createdReportId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok(), `cleanup of report ${createdReportId}`).toBeTruthy()
})

test('CP-001: a seeded user reports a found dog and the real AI matches it with the seeded lost report', async ({ page }) => {
  const password = process.env.SEED_DEMO_PASSWORD
  test.skip(!password, 'SEED_DEMO_PASSWORD is required (same value used by seed-demo)')
  await dismissLocationConsent(page)

  await page.goto('/login')
  await page.getByLabel('Email').fill(SMOKE_EMAIL)
  await page.getByLabel('Contraseña').fill(password!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/$/)
  token = await page.evaluate(() => JSON.parse(localStorage.getItem('patitas-auth') ?? '{}').state?.token)

  await page.goto('/reports/new')
  await page.locator('#reportType').selectOption({ label: 'Mascota Encontrada' })
  await page.getByLabel('Título *').fill(`Smoke demo ${Date.now()}`)
  await page.getByLabel('Descripción').fill('Perro negro con pecho blanco y collar rojo.')
  await page.locator('input[type=file]').setInputFiles(PHOTO)
  await expect(page.getByAltText('Foto 1')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /Usar mi ubicación actual/ }).click()
  await expect(page.getByText('Ubicación seleccionada')).toBeVisible()
  await page.getByRole('button', { name: 'Crear Reporte' }).click()

  await expect(page).toHaveURL(/\/reports\/\d+$/)
  createdReportId = page.url().match(/\/reports\/(\d+)$/)?.[1]
  await expect(page.getByText('Estado: Publicado')).toBeVisible({ timeout: 60_000 })

  const match = page.locator('.card').filter({ has: page.getByRole('heading', { name: SEEDED_LOST_TITLE }) })
  await expect(page.getByRole('heading', { name: 'Coincidencias sugeridas' })).toBeVisible()
  await expect(match).toBeVisible({ timeout: 15_000 })
  await expect(match.getByText(/\d+% de coincidencia/)).toBeVisible()
  await match.getByRole('button', { name: 'Confirmar coincidencia' }).click()
  await expect(match.getByText('Coincidencia confirmada')).toBeVisible()

  await match.getByRole('link').click()
  await expect(page.getByRole('heading', { name: SEEDED_LOST_TITLE })).toBeVisible()
  await page.getByRole('button', { name: 'Contactar al autor' }).click()
  await expect(page).toHaveURL(/\/chats\/\d+$/)

  const message = `Hola, creo que encontré a Toby (${Date.now()})`
  await page.getByPlaceholder('Escribí un mensaje…').fill(message)
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByRole('region', { name: 'Conversación' }).getByText(message)).toBeVisible()
})
