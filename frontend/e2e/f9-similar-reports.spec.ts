import { expect, loginAs, test } from './fixtures.ts'
import * as api from './support/api.ts'
import { BACKEND_URL } from './support/env.ts'

// Punto propio: los reportes de las otras specs quedan en el centro de Buenos Aires.
const SPOT = { lat: -38.0055, lng: -57.5426 }
test.use({ geolocation: { latitude: SPOT.lat, longitude: SPOT.lng } })

test('F9: creating a report suggests a similar one and opens it instead of publishing a duplicate', async ({ page, users }) => {
  const author = await users.create('f9-author')
  const finder = await users.create('f9-finder')
  const stamp = Date.now()
  const existing = await api.createPublishedReport(author.token, { reportType: 'found', title: `Caniche encontrado F9 ${stamp}`, location: SPOT })
  const own = await api.createPublishedReport(finder.token, { reportType: 'found', title: `Mi caniche F9 ${stamp}`, location: SPOT })
  const otherType = await api.createPublishedReport(author.token, { reportType: 'lost', title: `Perro perdido F9 ${stamp}`, location: SPOT })
  const draftTitle = `Duplicado F9 ${stamp}`

  await loginAs(page, finder)
  await page.goto('/reports/new')
  await page.getByLabel('Tipo de reporte *').selectOption('found')
  await page.getByLabel('Título *').fill(draftTitle)
  await page.getByRole('button', { name: /Usar mi ubicación actual/ }).click()

  const suggestions = page.getByRole('region', { name: '¿Alguno de estos coincide con tu avistamiento?' })
  const existingItem = suggestions.getByRole('listitem').filter({ hasText: existing.title })
  const ownItem = suggestions.getByRole('listitem').filter({ hasText: own.title })
  await expect(existingItem).toBeVisible()
  await expect(ownItem.getByRole('button', { name: /Ver mi reporte/ })).toBeVisible()
  await expect(suggestions.getByText(otherType.title)).toHaveCount(0)

  await existingItem.getByRole('button', { name: /Sí, es este.*Contactar al autor/ }).click()

  await expect(page).toHaveURL(new RegExp(`/reports/${existing.id}$`))
  await expect(page.getByRole('heading', { name: existing.title })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Contactar al autor' })).toBeVisible()

  // el borrador no se publicó
  const response = await page.request.get(`${BACKEND_URL}/api/reports?type=found`)
  const titles = ((await response.json()) as { title: string }[]).map((r) => r.title)
  expect(titles).toContain(existing.title)
  expect(titles).not.toContain(draftTitle)
})
