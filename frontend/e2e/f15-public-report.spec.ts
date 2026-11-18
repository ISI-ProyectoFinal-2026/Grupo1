import { expect, test } from './fixtures.ts'
import * as api from './support/api.ts'

// #187: the feed and the report detail are public, shareable material
test('F15: an anonymous visitor browses the feed and opens a report without logging in', async ({ page, users }) => {
  const owner = await users.create('f15-owner')
  const report = await api.createPublishedReport(owner.token, { reportType: 'lost', title: `Gata perdida F15 ${Date.now()}` })

  await page.goto('/reports')
  await expect(page).toHaveURL(/\/reports$/)
  await page.getByRole('heading', { name: report.title }).click()

  await expect(page).toHaveURL(new RegExp(`/reports/${report.id}$`))
  await expect(page.getByRole('heading', { level: 1, name: report.title })).toBeVisible()
  await expect(page.getByText('Estado: Publicado')).toBeVisible()
  // no account actions and no auth-only sections for a visitor
  await expect(page.getByRole('button', { name: 'Contactar al autor' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reportar cuenta' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Coincidencias sugeridas' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
